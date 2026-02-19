#!/usr/bin/env python3
import io
import json
import sys
import base64
import secrets
import struct
import subprocess
from typing import List
from PIL import Image

class StickerConverter:
    TARGET_SIZE = 512
    MAX_DURATION_SEC = 15
    DEFAULT_FPS = 15
    DEFAULT_QUALITY = 80
    
    @staticmethod
    def _random_hex(nbytes: int = 16) -> str:
        """Generate random hex string for pack ID"""
        return secrets.token_hex(nbytes)
    
    @staticmethod
    def _build_whatsapp_exif(
        pack_name: str = "",
        author_name: str = "",
        emojis: List[str] = None
    ) -> bytes:
        """Build WhatsApp EXIF metadata structure"""
        if emojis is None:
            emojis = []
            
        # WhatsApp compatible EXIF format
        metadata = {
            "sticker-pack-id": f"com.sticker.pack.{StickerConverter._random_hex(16)}",
            "sticker-pack-name": pack_name,
            "sticker-pack-publisher": author_name,
        }
        
        if emojis:
            metadata["emojis"] = emojis
        
        json_data = json.dumps(metadata, separators=(',', ':')).encode('utf-8')
        
        # TIFF header for EXIF (Little Endian)
        tiff_header = bytearray([
            0x49, 0x49,              # II = Little endian
            0x2A, 0x00,              # 42 (TIFF magic number)
            0x08, 0x00, 0x00, 0x00,  # Offset to first IFD
            0x01, 0x00,              # Number of directory entries
            0x41, 0x57,              # EXIF tag for user comment
            0x07, 0x00,              # Type: undefined
            0x00, 0x00, 0x00, 0x00,  # Count (length of data)
            0x16, 0x00, 0x00, 0x00   # Offset to data
        ])
        
        # Write JSON length
        json_len = len(json_data)
        tiff_header[14:18] = struct.pack('<I', json_len)
        
        return bytes(tiff_header) + json_data
    
    @staticmethod
    def _attach_exif_to_webp(webp_data: bytes, exif_data: bytes) -> bytes:
        """
        Attach EXIF metadata to WebP image (Pure Python In-Memory)
        Does not use external webpmux tool, performs direct byte manipulation.
        """
        if len(webp_data) < 12:
            raise ValueError("Invalid WebP data")
        
        if webp_data[:4] != b'RIFF' or webp_data[8:12] != b'WEBP':
            raise ValueError("Not a valid WebP file")
        
        chunks = []
        pos = 12
        
        # Parse existing chunks
        while pos < len(webp_data):
            if pos + 8 > len(webp_data):
                break
                
            chunk_fourcc = webp_data[pos:pos+4]
            chunk_size = struct.unpack('<I', webp_data[pos+4:pos+8])[0]
            chunk_data = webp_data[pos+8:pos+8+chunk_size]
            
            # Filter out existing EXIF to replace it
            if chunk_fourcc != b'EXIF':
                chunks.append((chunk_fourcc, chunk_data))
            
            pos += 8 + chunk_size
            # Padding byte if odd size
            if chunk_size % 2 == 1:
                pos += 1
        
        # Insert EXIF chunk immediately after the VP8/VP8L/VP8X header
        # Usually it's safe to put it as the second chunk (index 1) or first if list empty
        insert_pos = 1 if len(chunks) > 0 else 0
        chunks.insert(insert_pos, (b'EXIF', exif_data))
        
        # Reconstruct WebP
        output = io.BytesIO()
        output.write(b'RIFF')
        
        # Placeholder for file size (will be filled later)
        output.write(b'\x00\x00\x00\x00') 
        output.write(b'WEBP')
        
        for fourcc, data in chunks:
            output.write(fourcc)
            output.write(struct.pack('<I', len(data)))
            output.write(data)
            if len(data) % 2 == 1:
                output.write(b'\x00') # Padding
        
        result = output.getvalue()
        
        # Update file size in RIFF header
        file_size = len(result) - 8
        result = result[:4] + struct.pack('<I', file_size) + result[8:]
        
        return result
    
    @staticmethod
    def _resize_image(img: Image.Image, crop: bool = False) -> Image.Image:
        """Resize image to 512x512 handling transparency and aspect ratio"""
        w, h = img.size
        target = StickerConverter.TARGET_SIZE
        
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        if crop:
            # Crop to square
            side = min(w, h)
            left = (w - side) // 2
            top = (h - side) // 2
            img = img.crop((left, top, left + side, top + side))
            img = img.resize((target, target), Image.Resampling.LANCZOS)
        else:
            # Fit within square
            if w > h:
                new_w = target
                new_h = int(h * target / w)
            elif h > w:
                new_h = target
                new_w = int(w * target / h)
            else:
                new_w = new_h = target
            
            new_w = max(1, min(target, new_w))
            new_h = max(1, min(target, new_h))
            
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            canvas = Image.new('RGBA', (target, target), (0, 0, 0, 0))
            offset_x = (target - new_w) // 2
            offset_y = (target - new_h) // 2
            canvas.paste(img, (offset_x, offset_y), img)
            img = canvas
        
        return img

    def _process_video_with_ffmpeg(
        self,
        video_bytes: bytes,
        fps: int,
        max_duration: int,
        quality: int,
        crop: bool,
        pack_name: str,
        author_name: str,
        emojis: List[str]
    ) -> bytes:
        """
        Process video using FFmpeg via PIPES (No temp files)
        """
        target = self.TARGET_SIZE
        
        # Setup Video Filter
        if crop:
            vf = f"crop='min(iw,ih)':'min(iw,ih)',scale={target}:{target}:flags=lanczos,format=yuva420p"
        else:
            vf = f"scale={target}:{target}:force_original_aspect_ratio=decrease,pad={target}:{target}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=yuva420p"
            
        # FFmpeg command
        # pipe:0 = stdin (input)
        # pipe:1 = stdout (output)
        cmd = [
            'ffmpeg',
            '-hide_banner', '-loglevel', 'error',
            '-i', 'pipe:0', 
            '-vf', vf,
            '-c:v', 'libwebp',
            '-lossless', '0',
            '-compression_level', '4', # Balanced speed/size
            '-q:v', str(100 - quality),
            '-loop', '0',
            '-an', # Remove audio
            '-r', str(fps),
            '-t', str(max_duration),
            '-f', 'webp', # Force format to webp for stdout
            'pipe:1'
        ]
        
        try:
            # Run FFmpeg with piping
            process = subprocess.run(
                cmd,
                input=video_bytes,
                capture_output=True,
                timeout=60
            )
            
            if process.returncode != 0:
                error_log = process.stderr.decode('utf-8', errors='ignore')
                raise ValueError(f"FFmpeg Error: {error_log}")
            
            webp_data = process.stdout
            
            if not webp_data:
                raise ValueError("FFmpeg returned empty data")
                
            # Add EXIF directly to the bytes
            exif_data = self._build_whatsapp_exif(pack_name, author_name, emojis)
            return self._attach_exif_to_webp(webp_data, exif_data)
            
        except subprocess.TimeoutExpired:
            raise ValueError("Video conversion timed out")
        except Exception as e:
            raise ValueError(f"Video processing failed: {str(e)}")

    def _process_animated_image(
        self,
        img: Image.Image,
        fps: int,
        max_duration: int,
        quality: int,
        crop: bool,
        pack_name: str,
        author_name: str,
        emojis: List[str]
    ) -> bytes:
        """Process GIF/APNG via Pillow (In-Memory)"""
        max_frames = fps * max_duration
        duration_per_frame = int(1000 / fps)
        
        frames = []
        for i in range(min(img.n_frames, max_frames)):
            try:
                img.seek(i)
                frame = img.convert('RGBA')
                frame = self._resize_image(frame, crop)
                frames.append(frame)
            except EOFError:
                break
                
        output = io.BytesIO()
        exif_data = self._build_whatsapp_exif(pack_name, author_name, emojis)
        
        if not frames:
            raise ValueError("No frames extracted")

        frames[0].save(
            output,
            format='WEBP',
            save_all=True,
            append_images=frames[1:],
            duration=duration_per_frame,
            loop=0,
            quality=quality,
            method=6,
            exif=exif_data
        )
        return output.getvalue()

    def create_sticker(
        self,
        input_data: bytes,
        crop: bool = False,
        quality: int = DEFAULT_QUALITY,
        fps: int = DEFAULT_FPS,
        max_duration: int = MAX_DURATION_SEC,
        pack_name: str = "",
        author_name: str = "",
        emojis: List[str] = None
    ) -> bytes:
        """Entry point for creation"""
        
        # Check if input looks like a video/gif container for FFmpeg
        # (MP4, WebM, GIF)
        is_ffmpeg_candidate = False
        
        # Basic magic bytes check
        if len(input_data) > 12:
            if input_data[:3] == b'GIF': 
                # Use FFmpeg for GIF if PIL fails or for consistency, 
                # but PIL is often faster for simple GIFs. 
                # Let's try PIL first for GIFs, FFmpeg for videos.
                is_ffmpeg_candidate = False 
            elif (input_data[4:12] in [b'ftypmp42', b'ftypisom', b'ftypMSNV'] or 
                  input_data[:4] == b'\x1a\x45\xdf\xa3'): # WebM/MKV
                is_ffmpeg_candidate = True

        if is_ffmpeg_candidate:
            return self._process_video_with_ffmpeg(
                input_data, fps, max_duration, quality, crop,
                pack_name, author_name, emojis
            )

        # Try processing as Image (Static or Animated GIF/WebP) via PIL
        try:
            img = Image.open(io.BytesIO(input_data))
            
            if getattr(img, 'is_animated', False) and img.n_frames > 1:
                return self._process_animated_image(
                    img, fps, max_duration, quality, crop,
                    pack_name, author_name, emojis
                )
            else:
                # Static
                img = self._resize_image(img, crop)
                output = io.BytesIO()
                exif_data = self._build_whatsapp_exif(pack_name, author_name, emojis)
                img.save(
                    output, 
                    format='WEBP', 
                    quality=quality, 
                    method=6, 
                    exif=exif_data,
                    save_all=True
                )
                return output.getvalue()
                
        except Exception:
            # If PIL failed, try FFmpeg as a last resort (fallback for robust handling)
            try:
                return self._process_video_with_ffmpeg(
                    input_data, fps, max_duration, quality, crop,
                    pack_name, author_name, emojis
                )
            except Exception as e:
                raise ValueError(f"Could not convert media: {str(e)}")

    def add_exif(self, webp_data: bytes, pack_name: str, author_name: str, emojis: List[str]) -> bytes:
        exif = self._build_whatsapp_exif(pack_name, author_name, emojis)
        return self._attach_exif_to_webp(webp_data, exif)

def main():
    converter = StickerConverter()
    try:
        # Read from stdin
        input_line = sys.stdin.buffer.read()
        if not input_line:
            return

        request = json.loads(input_line.decode('utf-8'))
        command = request.get('command')
        
        if command == 'create':
            input_data = base64.b64decode(request.get('input'))
            opts = request.get('options', {})
            
            result = converter.create_sticker(
                input_data,
                crop=opts.get('crop', False),
                quality=opts.get('quality', 80),
                fps=opts.get('fps', 15),
                max_duration=opts.get('maxDuration', 15),
                pack_name=opts.get('packName', ''),
                author_name=opts.get('authorName', ''),
                emojis=opts.get('emojis', [])
            )
            print(json.dumps({'success': True, 'data': base64.b64encode(result).decode('utf-8')}))
            
        elif command == 'addExif':
            webp_data = base64.b64decode(request.get('input'))
            meta = request.get('metadata', {})
            result = converter.add_exif(
                webp_data,
                pack_name=meta.get('packName', ''),
                author_name=meta.get('authorName', ''),
                emojis=meta.get('emojis', [])
            )
            print(json.dumps({'success': True, 'data': base64.b64encode(result).decode('utf-8')}))
            
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == "__main__":
    main()