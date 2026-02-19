export async function capcutDl(url) {
  const res = await fetch('https://3bic.com/api/download', {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7",
        "content-type": "application/json",
        "sec-ch-ua": "\"Chromium\";v=\"139\", \"Not;A=Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": "\"Android\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "cookie": "cf_clearance=Kvfb9Yn25VTphkfDYWW4hVoF6CmZ6DmaGvlnjw4bS2U-1770624081-1.2.1.1-msAm9Bwg3KJCbwqox3FUC_AGk5FrJs1mZ0jtZnrI9f4Z.qhF_SxT9v2qKHhufFcbpVBgeaCukrYJMwXjha5i8vrdzu_2xVv1F.ctShbOhnxQSDz09C4p4ZNMxsd496jUDVkMLuAoBOLTs38o93HP.WYrnYxbF_Hna061hBSTtbg35zrDZqHR1RYm8bk6ewy1HO5pCKLpP4bqEY5rFL8YS7mX7xQCuhjxfmQ8dJiWIBk; __gads=ID=349991770e523ffa:T=1770624081:RT=1770624081:S=ALNI_MZsT5eWoGHVGWebUpEnxSduPxNQGg; __gpi=UID=000011f8381901d1:T=1770624081:RT=1770624081:S=ALNI_MZf-SswsYlPIwL8YOMqBEWd7WAO0w; __eoi=ID=c358a63f0c172216:T=1770624081:RT=1770624081:S=AA-AfjZPTiszKcmcLOLiP8eWdneM; FCCDCF=%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B32%2C%22%5B%5C%22a0241cb0-12e3-4797-af68-5c80725c86a6%5C%22%2C%5B1770624083%2C983000000%5D%5D%22%5D%5D%5D; FCNEC=%5B%5B%22AKsRol88nHjB4fx6L3m38LO7ysvJDzrSiq1tgAm6aeGU6p_opF85rF8A5zPZsACU33DR9bF1Rs14HR5or3k49JGXtGpu0HTFxiHiJEiTqGD27_CyyjSQGS6XAP1Gtv27wHZxO0AzYkTRx8dNZQvgIYr46phHaqbmew%3D%3D%22%5D%5D",
        "Referer": "https://3bic.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": JSON.stringify({ url }),
      "method": "POST",
    });
    if (!res.ok) throw new Error(res.status)
    const data = await res.json()
    const base64url = data?.originalVideoUrl?.split('/api/cdn/')[1]
    const videoUrl = Buffer.from(base64url, 'base64').toString()
    return {
      title: data.title,
      author: data.authorName,
      videoUrl
    };
}