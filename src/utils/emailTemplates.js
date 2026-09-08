// Driver Credentials Email
exports.driverCredentialsTemplate = (name, email, password) => `
  <h3>Hello ${name},</h3>
  <p>Your driver account has been created.</p>
  <p><b>Login Details:</b></p>
  <ul>
    <li>Email: ${email}</li>
    <li>Password: ${password}</li>
  </ul>
  <p>Please log in to your account using the credentials provided above.</p>
`;