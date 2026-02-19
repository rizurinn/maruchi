import * as cheerio from 'cheerio'
import { exec } from 'child_process'
import fs from 'fs/promises'
import { promisify } from 'util'

const execPromise = promisify(exec)

export async function bilibiliDl(url, quality = '480P') {
  let aid = /\/video\/(\d+)/.exec(url)?.[1]
  if (!aid) throw new Error('ID Video not found')

  const html = await fetch(url, {
     headers: { 'User-Agent': 'Mozilla/5.0' }
  }).then(v => v.text())
  const $ = cheerio.load(html)

  const title = $('meta[property="og:title"]').attr('content')?.split('|')[0]?.trim() || ''
  const description = $('meta[property="og:description"]').attr('content') || ''
  const type = $('meta[property="og:video:type"]').attr('content') || ''
  const cover = $('meta[property="og:image"]').attr('content') || ''
  const like = $('.interactive__btn.interactive__like .interactive__text').text() || ''
  const views = $('.bstar-meta__tips-left .bstar-meta-text').first().text().replace(' Ditonton', '') || ''

  const params = new URLSearchParams({
  s_locale: 'id_ID',
  platform: 'web',
  aid,
  qn: '64',
  type: '0',
  device: 'wap',
  tf: '0',
  spm_id: 'bstar-web.ugc-video-detail.0.0',
  from_spm_id: 'bstar-web.homepage.trending.all',
  fnval: '16',
  fnver: '0'
})

const play = await fetch(
  `https://api.bilibili.tv/intl/gateway/web/playurl?${params}`,
  { headers: { 'User-Agent': 'Mozilla/5.0' } }
).then(v => v.json())

  const videoSel = play.data.playurl.video.find(v => v.stream_info.desc_words === quality)
  if (!videoSel) throw new Error('No video found for specified quality')

  const videoUrl = videoSel.video_resource.url || videoSel.video_resource.backup_url?.[0]
  const audioUrl = play.data.playurl.audio_resource[0].url || play.data.playurl.audio_resource[0].backup_url?.[0]

  async function downloadBuffer(url) {
  let chunks = []
  let start = 0
  let end = 5 * 1024 * 1024 - 1
  let size = 0

  while (true) {
    const res = await fetch(url, {
      headers: {
        Range: `bytes=${start}-${end}`,
        Origin: 'https://www.bilibili.tv',
        Referer: 'https://www.bilibili.tv/video/',
        'User-Agent': 'Mozilla/5.0'
      }
    })

    const buf = Buffer.from(await res.arrayBuffer())

    if (!size) {
      const cr = res.headers.get('content-range')
      if (cr) size = Number(cr.split('/')[1])
    }

    chunks.push(buf)

    if (end >= size - 1) break
    start = end + 1
    end = Math.min(start + 5 * 1024 * 1024 - 1, size - 1)
  }

  return Buffer.concat(chunks)
}


  const vBuf = await downloadBuffer(videoUrl)
  const aBuf = await downloadBuffer(audioUrl)

  const vPath = 'tmp_v.mp4'
  const aPath = 'tmp_a.mp3'
  const oPath = 'tmp_o.mp4'

  await fs.writeFile(vPath, vBuf)
  await fs.writeFile(aPath, aBuf)

  await execPromise(`ffmpeg -i "${vPath}" -i "${aPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 "${oPath}"`)

  const out = await fs.readFile(oPath)

  await Promise.all([
    fs.unlink(vPath).catch(() => {}),
    fs.unlink(aPath).catch(() => {}),
    fs.unlink(oPath).catch(() => {})
  ])

  return {
    title,
    description,
    type,
    cover,
    views,
    like,
    buffer: out
  }
}
