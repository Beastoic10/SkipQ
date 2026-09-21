async function testFormPost() {
  console.log("Fetching /auth/login for standard form submission...");
  const getRes = await fetch("http://localhost:3000/auth/login");
  const html = await getRes.text();
  const cookies = getRes.headers.get("set-cookie") || "";

  const inputMatches = [...html.matchAll(/<input[^>]*type=["']hidden["'][^>]*>/gi)];
  const params = new URLSearchParams();

  for (const match of inputMatches) {
    const tag = match[0];
    const nameMatch = tag.match(/name=["']([^"']+)["']/i);
    const valueMatch = tag.match(/value=["']([^"']*)["']/i);
    if (nameMatch) {
      const name = nameMatch[1];
      const val = valueMatch ? valueMatch[1].replace(/&quot;/g, '"') : '';
      params.append(name, val);
    }
  }

  params.append("email", "terminal1@skipq.local");
  params.append("password", "Terminal123!");

  const postRes = await fetch("http://localhost:3000/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": "http://localhost:3000",
      "Referer": "http://localhost:3000/auth/login",
      "Cookie": cookies
    },
    body: params.toString(),
    redirect: "manual"
  });

  console.log("POST status:", postRes.status);
  console.log("POST location:", postRes.headers.get("location"));
  console.log("POST headers:", Object.fromEntries(postRes.headers.entries()));
  const text = await postRes.text();
  console.log("POST response snippet:", text.substring(0, 300));
}

testFormPost().catch(console.error);
