async function run() {
  const testEmail = `test_debug_${Date.now()}@gmail.com`;
  const password = "Password123!";

  console.log("Calling /api/debug-signup for:", testEmail);
  const res = await fetch("http://localhost:3000/api/debug-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: password,
      confirmPassword: password
    })
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

run().catch(console.error);
