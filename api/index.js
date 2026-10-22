module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      message: 'Method tidak diizinkan.'
    });
  }

  const gasUrl = process.env.GAS_URL;

  if (
    !gasUrl ||
    !gasUrl.startsWith('https://script.google.com/')
  ) {
    return res.status(500).json({
      ok: false,
      message: 'Backend belum dikonfigurasi.'
    });
  }

  try {
    const upstream = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      // PERBAIKAN: jangan membungkus dua kali jika body sudah berupa string
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    });

    const result = await upstream.json();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: 'Backend tidak dapat dihubungi.'
    });
  }
};
