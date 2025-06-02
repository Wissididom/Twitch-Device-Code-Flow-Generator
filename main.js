var dcfInterval = null;

function initTextBoxes() {
  const queryParams = getClientIdAndScopesFromQuery();
  document.getElementById("clientId").value = queryParams.clientId;
  document.getElementById("scopes").value = queryParams.scopes.join(", ");
}

function getClientIdAndScopesFromQuery() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    clientId: urlParams.get("clientId"),
    scopes: urlParams.get("scopes").split(/(?:,|;| )/g),
  };
}

async function getUser(clientId, accessToken) {
  const userResponse = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
    },
  }).then((res) => res.json());
  return userResponse.data[0];
}

async function getAccountAccess(clientId, scopes) {
  if (dcfInterval) {
    clearInterval(dcfInterval);
    dcfInterval = null;
  }
  const scopesStr = typeof scopes === "string"
    ? encodeURIComponent(scopes)
    : encodeURIComponent(scopes.join(" "));
  console.log("Scopes requested:", scopes, scopesStr);
  const tokens = {
    access_token: null,
    refresh_token: null,
    device_code: null,
    user_code: null,
    verification_uri: null,
    user_id: null,
  };
  const dcf = await fetch(
    `https://id.twitch.tv/oauth2/device?client_id=${clientId}&scopes=${scopesStr}`,
    {
      method: "POST",
    },
  );
  if (dcf.status >= 200 && dcf.status < 300) {
    // Successfully got DCF data
    const dcfJson = await dcf.json();
    tokens.device_code = dcfJson.device_code;
    tokens.user_code = dcfJson.user_code;
    tokens.verification_uri = dcfJson.verification_uri;
    console.log(
      `Open ${tokens.verification_uri} and enter ${tokens.user_code} there!`,
    );
    document.getElementById("openAuth").removeAttribute("disabled");
    document.getElementById("openAuth").setAttribute(
      "href",
      tokens.verification_uri,
    );
    document.getElementById("openAuthBtn").removeAttribute("disabled");
  } else {
    alert(`Failed to get DCF data: ${await dcf.text()}`);
    return;
  }
  dcfInterval = setInterval(async () => {
    const tokenResponse = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&scopes=${scopesStr}&device_code=${tokens.device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
      {
        method: "POST",
      },
    );
    const tokenJson = await tokenResponse.json();
    if (
      tokenResponse.status == 400 &&
      tokenJson.message == "authorization_pending"
    ) return;
    if (tokenResponse.status >= 200 && tokenResponse.status < 300) {
      // Successfully got token
      tokens.access_token = tokenJson.access_token;
      tokens.refresh_token = tokenJson.refresh_token;
      const user = await getUser(clientId, tokens.access_token);
      clearInterval(dcfInterval);
      dcfInterval = null;
      console.log(
        `Got Device Code Flow Tokens for ${user.display_name} (${user.login}, Scopes: ${
          decodeURIComponent(scopesStr)
        })`,
      );
      alert(
        `Got Device Code Flow Tokens for ${user.display_name} (${user.login}, Scopes: ${
          decodeURIComponent(scopesStr)
        })`,
      );
    }
  }, 1000);
}

document.addEventListener("DOMContentLoaded", function () {
  initTextBoxes();
});
