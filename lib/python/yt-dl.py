#!/usr/bin/env python3
import sys
import json
import yt_dlp
import os
import re
import urllib.request
from pathlib import Path
import io
import shutil

# Fix encoding output untuk karakter Unicode/Emoji di judul lagu
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# --- UTILS ---

class SuppressOutput:
    def __enter__(self):
        self._original_stdout = sys.stdout
        self._original_stderr = sys.stderr
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout = self._original_stdout
        sys.stderr = self._original_stderr

def find_js_runtime():
    runtimes = ['bun', 'node']
    for runtime in runtimes:
        path = shutil.which(runtime)
        if path:
            return path
    return None

def get_base_opts():
    opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'cachedir': False,
        'noprogress': True,
        'writethumbnail': True,
        'updatetime': False,
        'remote_components': ['ejs:github'],
    }
    
    js_runtime = find_js_runtime()
    if js_runtime:
        opts['js_runtimes'] = {os.path.basename(js_runtime): {'path': js_runtime}}

    cookie_file = Path('./data/cok.txt')
    if cookie_file.exists():
        opts['cookiefile'] = str(cookie_file)

    return opts

# --- SPOTIFY HELPER (IMPROVED) ---

class SpotifyScraper:
    @staticmethod
    def get_metadata(url):
        try:
            # Validasi URL dasar
            if "spotify.com" not in url:
                raise ValueError("Bukan link Spotify yang valid.")

            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
            req = urllib.request.Request(url, headers=headers)
            
            with urllib.request.urlopen(req) as response:
                html = response.read().decode('utf-8')

            title = "Unknown Track"
            artist = "Unknown Artist"
            image_url = None

            # 1. Ambil Cover Art (og:image)
            og_image = re.search(r'<meta property="og:image" content="(.*?)"', html)
            if og_image:
                image_url = og_image.group(1)

            # 2. Ambil Judul & Artis dari <title> tag (Metode Paling Akurat)
            # Format umum: "Judul Lagu - song by Nama Artis | Spotify" atau "Judul - Single by Artis | Spotify"
            title_tag_match = re.search(r'<title>(.*?)</title>', html)
            if title_tag_match:
                full_title_tag = title_tag_match.group(1).replace(" | Spotify", "")
                
                # Coba split berdasarkan pola umum Spotify
                separators = [" - song by ", " - Single by ", " - EP by ", " - Album by "]
                for sep in separators:
                    if sep in full_title_tag:
                        parts = full_title_tag.split(sep)
                        title = parts[0].strip()
                        artist = parts[1].strip()
                        break
                
                # Jika tidak ketemu separator spesifik, coba fallback " by "
                if artist == "Unknown Artist" and " by " in full_title_tag:
                    # Hati-hati, "Song by Me by Artist" -> split terakhir
                    parts = full_title_tag.rsplit(" by ", 1)
                    title = parts[0].strip()
                    artist = parts[1].strip()

            # 3. Fallback ke og:description jika title tag gagal parsing
            if artist == "Unknown Artist":
                og_desc = re.search(r'<meta property="og:description" content="(.*?)"', html)
                if og_desc:
                    desc = og_desc.group(1)
                    # Pola 1: "Listen to Judul on Spotify. Artis · Song · 2024."
                    match_p1 = re.search(r'Spotify\.\s(.*?)\s·', desc)
                    if match_p1:
                        artist = match_p1.group(1)
                    else:
                        # Pola 2: "Judul, a song by Artis on Spotify"
                        match_p2 = re.search(r'a song by (.*?) on Spotify', desc)
                        if match_p2:
                            artist = match_p2.group(1)

            # 4. Fallback Judul jika masih kosong (ambil og:title)
            if title == "Unknown Track":
                og_title = re.search(r'<meta property="og:title" content="(.*?)"', html)
                if og_title:
                    title = og_title.group(1)

            # Bersihkan HTML entities jika ada (e.g. &amp; -> &)
            title = title.replace("&amp;", "&").replace("&#039;", "'").replace("&quot;", '"')
            artist = artist.replace("&amp;", "&").replace("&#039;", "'").replace("&quot;", '"')

            return {
                'title': title.split(' - ')[0] or title,
                'artist': artist,
                'thumbnail': image_url,
                'query': f"{artist} - {title} official audio"
            }
        except Exception as e:
            raise Exception(f"Spotify Scraping Error: {str(e)}")

# --- DOWNLOADERS ---

def get_video_info(url):
    try:
        ydl_opts = get_base_opts()
        ydl_opts['writethumbnail'] = False 
        
        with SuppressOutput():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
        
        duration = info.get('duration', 0)
        resolutions = []
        for fmt in info.get('formats', []):
            if fmt.get('vcodec') != 'none' and fmt.get('height'):
                size = fmt.get('filesize') or fmt.get('filesize_approx')
                resolutions.append({
                    'resolution': f"{fmt['height']}p",
                    'ext': fmt.get('ext', 'Unknown'),
                    'size_mb': round(size / 1024 / 1024, 2) if size else 'Unknown',
                })
        
        unique_resolutions = list({v['resolution']: v for v in resolutions}.values())
        
        return {
            'title': info.get('title', ''),
            'channel': info.get('uploader', ''),
            'duration': f"{duration // 60}:{duration % 60:02d}",
            'views': f"{info.get('view_count', 0):,}",
            'upload_date': info.get('upload_date', 'Unknown'),
            'thumbnail': info.get('thumbnail', ''),
            'description': info.get('description', ''),
            'videoUrl': url,
            'resolutions': unique_resolutions
        }
    except Exception as e:
        return {'error': str(e)}

def download_video(url, quality='720', output_dir='tmp'):
    try:
        if isinstance(quality, str) and quality != 'best':
            resolution = int(quality.replace('p', ''))
        else:
            resolution = 1080

        os.makedirs(output_dir, exist_ok=True)
        ydl_opts = get_base_opts()
        
        format_str = (
            f'bestvideo[height<={resolution}][vcodec^=avc]+bestaudio[acodec^=mp4a]/'
            f'best[height<={resolution}][ext=mp4]/'
            f'best[height<={resolution}]'
        )

        ydl_opts.update({
            'format': format_str,
            'outtmpl': os.path.join(output_dir, '%(title)s_%(height)sp.%(ext)s'),
            'merge_output_format': 'mp4',
            'noplaylist': True,
            'postprocessors': [
                {'key': 'FFmpegMetadata', 'add_chapters': True, 'add_metadata': True},
                {'key': 'EmbedThumbnail'}
            ],
            'postprocessor_args': {'ffmpeg': ['-movflags', '+faststart']}
        })
        
        with SuppressOutput():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                file_path = ydl.prepare_filename(info)

        if not os.path.exists(file_path):
            base_name = os.path.splitext(file_path)[0]
            if os.path.exists(base_name + '.mp4'): file_path = base_name + '.mp4'

        return {
            'title': info.get('title', ''),
            'channel': info.get('uploader', ''),
            'duration': info.get('duration', 0),
            'thumbnail': info.get('thumbnail', ''),
            'file_path': file_path,
            'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
            'quality': f"{info.get('height', 'unknown')}p",
            'format': 'mp4 (H.264)'
        }
    except Exception as e:
        return {'error': str(e)}

def download_audio(url, bitrate='128', output_dir='tmp', metadata_override=None):
    try:
        valid_bitrates = ['32', '64', '96', '128', '192', '256', '320']
        if bitrate not in valid_bitrates: bitrate = '128'
        
        os.makedirs(output_dir, exist_ok=True)
        ydl_opts = get_base_opts()
        
        ydl_opts.update({
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(output_dir, '%(title)s_audio.%(ext)s'),
            'noplaylist': True,
            'postprocessors': [
                {'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': bitrate},
                {'key': 'FFmpegMetadata', 'add_metadata': True},
                {'key': 'EmbedThumbnail'}, 
            ],
        })

        if metadata_override:
            safe_title = "".join([c for c in metadata_override['title'] if c.isalpha() or c.isdigit() or c==' ']).rstrip()
            safe_artist = "".join([c for c in metadata_override['artist'] if c.isalpha() or c.isdigit() or c==' ']).rstrip()
            ydl_opts['outtmpl'] = os.path.join(output_dir, f"{safe_artist} - {safe_title}.%(ext)s")
        
        with SuppressOutput():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                real_url = url if url.startswith('http') else f"ytsearch1:{url}"
                info = ydl.extract_info(real_url, download=True)
                if 'entries' in info: info = info['entries'][0]
                base_path = ydl.prepare_filename(info)
                file_path = os.path.splitext(base_path)[0] + '.mp3'
                
        # --- MANUAL METADATA INJECTION (FFMPEG) UNTUK SPOTIFY ---
        if metadata_override and os.path.exists(file_path):
            temp_output = file_path.replace('.mp3', '_temp.mp3')
            cover_path = os.path.join(output_dir, 'temp_cover.jpg')
            has_cover = False
            
            if metadata_override.get('thumbnail'):
                try:
                    urllib.request.urlretrieve(metadata_override['thumbnail'], cover_path)
                    has_cover = True
                except: pass

            ffmpeg_cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', file_path]
            
            if has_cover:
                ffmpeg_cmd.extend(['-i', cover_path, '-map', '0:a', '-map', '1:0', '-c:v', 'copy', '-id3v2_version', '3', '-metadata:s:v', 'title="Album cover"', '-metadata:s:v', 'comment="Cover (front)"'])
            else:
                ffmpeg_cmd.extend(['-map', '0:a'])

            ffmpeg_cmd.extend([
                '-c:a', 'copy',
                '-metadata', f"title={metadata_override['title']}",
                '-metadata', f"artist={metadata_override['artist']}",
                '-metadata', f"album={metadata_override['title']} (Single)",
                temp_output
            ])
            
            import subprocess
            subprocess.run(ffmpeg_cmd)
            
            if os.path.exists(temp_output):
                os.remove(file_path)
                os.rename(temp_output, file_path)
            
            if has_cover and os.path.exists(cover_path):
                os.remove(cover_path)

            info['title'] = metadata_override['title']
            info['uploader'] = metadata_override['artist']
            info['thumbnail'] = metadata_override['thumbnail']

        return {
            'title': info.get('title', ''),
            'channel': info.get('uploader', '') or info.get('channel', ''),
            'duration': info.get('duration', 0),
            'thumbnail': info.get('thumbnail', ''),
            'file_path': file_path,
            'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
            'bitrate': f"{bitrate}kbps",
            'format': 'mp3',
            'source': 'Spotify Match' if metadata_override else 'YouTube'
        }
            
    except Exception as e:
        return {'error': str(e)}

def search_youtube(query, max_results=10):
    try:
        ydl_opts = get_base_opts()
        ydl_opts.update({'extract_flat': True, 'writethumbnail': False})
        
        with SuppressOutput():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(f"ytsearch{max_results}:{query}", download=False)
        
        videos = []
        for entry in result.get('entries', []):
            videos.append({
                'title': entry.get('title', ''),
                'url': f"https://www.youtube.com/watch?v={entry.get('id', '')}",
                'thumbnail': entry.get('thumbnail', ''),
                'duration': entry.get('duration', 0),
                'channel': entry.get('uploader', ''),
                'views': entry.get('view_count', 0)
            })
        return videos
    except Exception as e:
        return {'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No command provided'}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'info' and len(sys.argv) > 2:
            print(json.dumps(get_video_info(sys.argv[2]), ensure_ascii=False, indent=2))
            
        elif command == 'video' and len(sys.argv) > 2:
            url = sys.argv[2]
            qual = sys.argv[3] if len(sys.argv) > 3 else '720'
            out = sys.argv[4] if len(sys.argv) > 4 else './tmp'
            print(json.dumps(download_video(url, qual, out), ensure_ascii=False, indent=2))
            
        elif command == 'audio' and len(sys.argv) > 2:
            url = sys.argv[2]
            bit = sys.argv[3] if len(sys.argv) > 3 else '128'
            out = sys.argv[4] if len(sys.argv) > 4 else './tmp'
            print(json.dumps(download_audio(url, bit, out), ensure_ascii=False, indent=2))
        
        elif command == 'spotify' and len(sys.argv) > 2:
            spotify_url = sys.argv[2]
            bit = sys.argv[3] if len(sys.argv) > 3 else '128'
            out = sys.argv[4] if len(sys.argv) > 4 else './tmp'
            
            meta = SpotifyScraper.get_metadata(spotify_url)
            result = download_audio(meta['query'], bit, out, metadata_override=meta)
            
            result['metadata'] = {
                'title': meta['title'],
                'artist': meta['artist'],
                'url': spotify_url
            }
            print(json.dumps(result, ensure_ascii=False, indent=2))

        elif command == 'search' and len(sys.argv) > 2:
            q = sys.argv[2]
            limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            print(json.dumps(search_youtube(q, limit), ensure_ascii=False, indent=2))
            
        else:
            print(json.dumps({'error': 'Invalid command'}, ensure_ascii=False))
            
    except Exception as e:
        print(json.dumps({'error': str(e)}, ensure_ascii=False))
        sys.exit(1)
