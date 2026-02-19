const mfDownload = async function (mfUrl){
    const r = await fetch(mfUrl,{
        headers : {
            "accept-encoding" : "gzip, deflate, br, zstd"
        }
    })
    if(!r.ok) throw Error (`${r.status} ${r.statusText}`)
    const html = await r.json()
    const url = html.match(/href="(.+?)" +id="downloadButton"/)?.[1]
    if(!url) throw Error (`gagal menemukan match url`)

    const ft_m = html.match(/class="filetype"><span>(.+?)<(?:.+?) \((.+?)\)/)
    const fileType = `${ft_m?.[1] || '(no ext)'} ${ft_m?.[2] || '(no ext)'}`

    const d_m = html.match(/<div class="description">(.+?)<\/div>/s)?.[1]
    const titleExt = d_m.match(/subheading">(.+?)</)?.[1] || '(no title extension)'
    const descriptionExt = d_m.match(/<p>(.+?)<\/p>/)?.[1] || '(no about extension)'

    const fileSize = html.match(/File size: <span>(.+?)<\/span>/)?.[1] || '(no file size)'
    const uploaded = html.match(/Uploaded: <span>(.+?)<\/span>/)?.[1] || '(no date)'
    const fileName = html.match(/class="filename">(.+?)<\/div>/)?.[1] || '(no file name)'
    const result = {fileName, fileSize, url, uploaded, fileType, titleExt, descriptionExt}

    return result
}

export { mfDownload }
