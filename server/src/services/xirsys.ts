import fetch from 'node-fetch';

export async function getTurnCredentials() {
  const xirsysUrl = 'https://global.xirsys.net/_turn/ChatApp';
  const auth = {
    ident: process.env.XIRSYS_IDENT,
    secret: process.env.XIRSYS_SECRET,
    domain: 'yourdomain.com',
    room: 'default',
    secure: 1
  };

  const response = await fetch(xirsysUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${auth.ident}:${auth.secret}`).toString('base64')
    },
    body: JSON.stringify(auth)
  });

  const data = await response.json();
  return data.v;
} 