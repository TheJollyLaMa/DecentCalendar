/* w3upClient.js — browser-compatible w3up/web3.storage email-auth flow.
   Uses window.w3up (loaded via CDN browser.min.js bundle).
   Export: connectW3upClient(autoConnect) */

export async function connectW3upClient(autoConnect = false) {
  try {
    console.log('Initializing w3up client...');
    const client = await window.w3up.create();
    console.log('Client ready:', client);

    // Check for existing credentials/spaces before prompting for email
    const spaces = await client.spaces();
    if (spaces && spaces.length > 0) {
      // Credentials already stored — no prompt needed
      const space = spaces[0];
      await client.setCurrentSpace(space.did());
      console.log('Connected to space (auto-restored):', space.did());
      return { client, spaceDid: space.did() };
    }

    if (!autoConnect) {
      // Only prompt for email if not auto-connect
      const email = prompt('Enter your email to login:');
      if (!email) {
        alert('Please enter a valid email to login.');
        return null;
      }
      const account = await client.login(email);
      console.log('Login successful:', account);
      if (account.plan) {
        await account.plan.wait();
        console.log('Payment plan confirmed.');
      }
      const spacesAfter = await client.spaces();
      if (!spacesAfter.length) {
        console.warn('No spaces found after login.');
        return null;
      }
      const space = spacesAfter[0];
      await client.setCurrentSpace(space.did());
      console.log('Connected to space:', space.did());
      return { client, spaceDid: space.did() };
    } else {
      // autoConnect = true but no stored credentials
      console.warn('No stored credentials found for autoConnect.');
      return null;
    }
  } catch (err) {
    console.error('Error initializing w3up client:', err);
    return null;
  }
}
