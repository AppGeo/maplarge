

export const getJson = async(url, params={})=> {
  const fixedUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    fixedUrl.searchParams.append(key, value)
  }
  const finalUrl = fixedUrl.toString();
  const data = await fetch(finalUrl);
  if (data.status > 299) {
    const text = await data.text();
    throw new Error(text || data.status);
  }
  return data.json();
}

export const post = async (url, parmas) => {
  const body = new URLSearchParams(parmas);
  const data = await fetch(url, {
    method: 'POST',
    headers:{
      'content-type':  'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });
  if (data.status > 299) {
    const text = await data.text();
    throw new Error(text || data.status);
  }
  return data.json();
}
