const formatPostInfo = (postInfo) => ({
  ...postInfo,
  postID: `https://lahelu.com/post/${postInfo.postID}`,
  media: `${postInfo.media}`,
  mediaThumbnail:
    postInfo.mediaThumbnail == null
      ? null
      : `https://cache.lahelu.com/${postInfo.mediaThumbnail}`,
  userUsername: `https://lahelu.com/user/${postInfo.userUsername}`,
  userAvatar: `https://cache.lahelu.com/${postInfo.userAvatar}`,
  createTime: new Date(postInfo.createTime).toISOString(),
});

function getRandomNumber() {
  return Math.floor(Math.random() * 5);
}

function getRandomField() {
  const choices = [5, 6, 7]
  return choices[Math.floor(Math.random() * choices.length)]
}

function fetchWithTimeout(url, options = {}, timeout = 30000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout)
    ),
  ]);
}

export async function laheluRandom() {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Referer": "https://lahelu.com",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "application/json, text/plain, */*",
      "Connection": "keep-alive",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "DNT": "1",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "TE": "Trailers",
      "Host": "lahelu.com",
      "Origin": "https://lahelu.com",
      "X-Requested-With": "XMLHttpRequest",
    };

    const url = `https://lahelu.com/api/post/get-recommendations?field=${getRandomField()}&cursor=${getRandomNumber()}`;

    const response = await fetchWithTimeout(url, { headers }, 30000);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (data?.postInfos) {
      return data.postInfos.map(formatPostInfo);
    } else {
      throw new Error("Invalid API response: missing postInfos");
    }
  } catch (error) {
    throw new Error(error.stack);
  }
}
