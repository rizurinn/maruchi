const sidompul = async (number) => {
  if (!number) {
    return { 
      success: false, 
      message: 'Nomor tidak boleh kosong',
      results: null 
    };
  }

  try {
    const url = new URL('https://bendith.my.id/end.php');
    url.search = new URLSearchParams({
      check: 'package',
      number: number,
      version: 2
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        message: data.message || 'Gagal mengambil data',
        results: null
      };
    }

    return {
      success: true,
      results: data.data
    };

  } catch (err) {
    return { 
      success: false, 
      message: err.message,
      results: null 
    };
  }
};

export { sidompul };