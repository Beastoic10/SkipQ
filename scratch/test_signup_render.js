async function test() {
  const getRes = await fetch('http://localhost:3000/auth/signup');
  const html = await getRes.text();
  const inputMatches = [...html.matchAll(/<input[^>]*type=["']hidden["'][^>]*>/gi)];
  const params = new URLSearchParams();
  for (const match of inputMatches) {
    const nameMatch = match[0].match(/name=["']([^"']+)["']/i);
    const valueMatch = match[0].match(/value=["']([^"']*)["']/i);
    if (nameMatch) {
      params.append(nameMatch[1], valueMatch ? valueMatch[1].replace(/&quot;/g, '"') : '');
    }
  }
  params.append('email', 'freshuser123@gmail.com');
  params.append('password', 'Password123!');
  params.append('confirmPassword', 'Password123!');

  const postRes = await fetch('http://localhost:3000/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'http://localhost:3000',
      'Referer': 'http://localhost:3000/auth/signup'
    },
    body: params.toString(),
    redirect: 'manual'
  });
  const resHtml = await postRes.text();
  console.log('Status:', postRes.status);
  console.log('Has role alert:', resHtml.includes('role="alert"'));
  const alertMatch = resHtml.match(/<div[^>]*role="alert"[^>]*>([\s\S]*?)<\/div>/i);
  if (alertMatch) console.log('Alert content:', alertMatch[0]);
  else console.log('No alert found in HTML!');

  const messageMatch = resHtml.match(/<div[^>]*class="[^"]*bg-emerald-50[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (messageMatch) console.log('Success message content:', messageMatch[0]);
  else console.log('No success message found in HTML!');
}
test().catch(console.error);
