export async function douyinDl(url) {
  if (!url) return null;

  try {
    const form = new URLSearchParams({ url });
    const apiRes = await fetch("https://savedouyin.net/proxy.php", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "origin": "https://savedouyin.net",
        "user-agent": "Mozilla/5.0"
      },
      body: form.toString()
    });

    if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);
    const apiResponse = await apiRes.json();

    const videoJsonUrl = apiResponse?.api?.mediaItems?.[0]?.mediaUrl;
    const audioJsonUrl = apiResponse?.api?.mediaItems?.[1]?.mediaUrl;

    if (!videoJsonUrl || !audioJsonUrl) {
      throw new Error("Invalid media URLs from API.");
    }

    const videoJsonRes = await fetch(videoJsonUrl);
    const videoFileData = await videoJsonRes.json();
    const finalVideoUrl = videoFileData?.fileUrl;

    const audioJsonRes = await fetch(audioJsonUrl);
    const audioFileData = await audioJsonRes.json();
    const finalAudioUrl = audioFileData?.fileUrl;

    if (!finalVideoUrl || !finalAudioUrl) {
      throw new Error("Final download URL not found.");
    }

    return {
      title: apiResponse.api.description,
      author: apiResponse.api.userInfo.name,
      media: {
        video: finalVideoUrl,
        audio: finalAudioUrl,
      }
    };

  } catch (e) {
    throw e;
  }
}
