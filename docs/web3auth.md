# Embedded Wallets SDK for React


## Overview​

MetaMask Embedded Wallets SDK (formerly Web3Auth Plug and Play) provides authentication
for React applications with social logins, external wallets, and more. React hooks
simplify how you connect users to their preferred wallets and manage authentication state.

For a complete working project, see the
[React quick start example](https://github.com/Web3Auth/web3auth-examples/tree/main/quick-starts/react-quick-start)
on GitHub.

Use the [Web SDK v11 migration guide](https://docs.metamask.io/embedded-wallets/migration-guides/web/). It includes an LLM agent prompt, a full v9/v10-to-v11 API map, and step-by-step changes for `@web3auth/modal/react`.


## Requirements​

- This is a frontend SDK and must be used in a browser environment
- Node.js 22+ and npm 10+
- Basic knowledge of JavaScript and React


## Prerequisites​

- Set up your project on the [Embedded Wallets dashboard](https://developer.metamask.io/)

See the [dashboard setup](https://docs.metamask.io/embedded-wallets/dashboard/) guide to learn more.


## Installation​

Install the Web3Auth Modal SDK and Wagmi dependencies:

```
npm install --save @web3auth/modal wagmi@3 @tanstack/react-query

```


### 1. Configuration​

Create a configuration file with your Client ID and Sapphire network from the
[Embedded Wallets dashboard](https://developer.metamask.io/).

Use **Sapphire Devnet** for local development (`http://localhost`). Sapphire Mainnet does not allow
localhost origins.

```
import { type Web3AuthContextConfig } from '@web3auth/modal/react'

import { WEB3AUTH_NETWORK } from '@web3auth/modal'



const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID // or your env prefix



const web3AuthContextConfig: Web3AuthContextConfig = {

  web3AuthOptions: {

    clientId,

    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET, // use SAPPHIRE_MAINNET in production

  },

}



export default web3AuthContextConfig

```


### 2. Set up providers​

In your main entry file (`main.tsx` or `index.tsx`), wrap your app with `Web3AuthProvider`,
`QueryClientProvider`, and the Embedded Wallets `WagmiProvider`:

```
import './index.css'



import ReactDOM from 'react-dom/client'

import { Web3AuthProvider } from '@web3auth/modal/react'

import { WagmiProvider } from '@web3auth/modal/react/wagmi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import web3AuthContextConfig from './web3authContext'

import App from './App'



const queryClient = new QueryClient()



ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(

  <Web3AuthProvider config={web3AuthContextConfig}>

    <QueryClientProvider client={queryClient}>

      <WagmiProvider>

        <App />

      </WagmiProvider>

    </QueryClientProvider>

  </Web3AuthProvider>

)

```


### 3. Connect users​

Use [useWeb3AuthConnect](https://docs.metamask.io/embedded-wallets/sdk/react/hooks/useWeb3AuthConnect/) to open the pre-built modal or connect to a
specific login method:

```
import { useWeb3AuthConnect, useWeb3AuthDisconnect } from '@web3auth/modal/react'

import { useConnection } from 'wagmi'



function App() {

  const { connect, loading, isConnected, error } = useWeb3AuthConnect()

  const { disconnect } = useWeb3AuthDisconnect()

  const { address } = useConnection()



  if (!isConnected) {

    return (

      <button onClick={() => connect()} disabled={loading}>

        {loading ? 'Connecting...' : 'Login'}

      </button>

    )

  }



  return (

    <div>

      <p>{address}</p>

      <button onClick={() => disconnect()}>Log out</button>

    </div>

  )

}

```


## Advanced configuration​

The Web3Auth Modal SDK offers a rich set of advanced configuration options:

- **Smart accounts:** Configure account abstraction parameters.
- **Custom authentication:** Define authentication methods.
- **Whitelabeling and UI customization:** Personalize the modal's appearance.
- **Multi-Factor Authentication (MFA):** Set up and manage MFA.
- **Wallet Services:** Integrate additional Wallet Services.

See the [advanced configuration](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/) section to learn more about each configuration option.

```
import { type Web3AuthContextConfig } from '@web3auth/modal/react'

import { WEB3AUTH_NETWORK } from '@web3auth/modal'



const web3AuthContextConfig: Web3AuthContextConfig = {

  web3AuthOptions: {

    clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID,

    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,

  },

}

```


## Blockchain integration​

Web3Auth is blockchain agnostic, enabling integration with any blockchain network. Out of the box,
Web3Auth offers robust support for both **Solana** and **Ethereum**, each with dedicated React hooks.


### Solana integration​

Solana hooks are included natively within the `@web3auth/modal` package. Install
[@solana/kit](https://www.npmjs.com/package/@solana/kit), [@solana-program/system](https://www.npmjs.com/package/@solana-program/system), and
[@solana/react-hooks](https://www.npmjs.com/package/@solana/react-hooks), then wrap your app with `SolanaProvider`:

```
import { SolanaProvider } from '@web3auth/modal/react/solana'



ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(

  <Web3AuthProvider config={web3AuthContextConfig}>

    <SolanaProvider>

      <App />

    </SolanaProvider>

  </Web3AuthProvider>

)

```

Use hooks from `@web3auth/modal/react/solana`.

For detailed usage and examples, see the [Solana hooks](https://docs.metamask.io/embedded-wallets/sdk/react/solana-hooks/) section.


### Ethereum integration​

Ethereum wallet operations use [Wagmi](https://wagmi.sh/) hooks after the provider setup above.
Configure EVM chains in the [Embedded Wallets dashboard](https://docs.metamask.io/embedded-wallets/dashboard/chains-and-networks/); no
in-app chain list is required for standard integrations.

For implementation details and examples, refer to the [Ethereum hooks](https://docs.metamask.io/embedded-wallets/sdk/react/ethereum-hooks/) section.


## Troubleshooting​


### JWT errors​

When using custom authentication, you may encounter JWT errors:

- [Invalid JWT verifiers ID field](https://docs.metamask.io/embedded-wallets/troubleshooting/jwt-errors/#invalid-jwt-verifiers-id-field)
- [Failed to verify JWS signature](https://docs.metamask.io/embedded-wallets/troubleshooting/jwt-errors/#failed-to-verify-jws-signature)
- [Duplicate token](https://docs.metamask.io/embedded-wallets/troubleshooting/jwt-errors/#duplicate-token)
- [Expired token](https://docs.metamask.io/embedded-wallets/troubleshooting/jwt-errors/#expired-token)
- [Mismatch JWT validation field](https://docs.metamask.io/embedded-wallets/troubleshooting/jwt-errors/#mismatch-jwt-validation-field)

# Advanced configuration

The Embedded Wallets SDK provides extensive configuration options that allow you to customize authentication flows, UI appearance, blockchain integrations, and security features to meet your application's specific requirements.


## Configuration structure​

When setting up Web3Auth, you'll create a configuration object that is passed to the `Web3AuthProvider`. This consists of:

```
import { type Web3AuthContextConfig } from '@web3auth/modal/react'

import { WEB3AUTH_NETWORK, type Web3AuthOptions } from '@web3auth/modal'



const web3AuthOptions: Web3AuthOptions = {

  clientId: 'YOUR_WEB3AUTH_CLIENT_ID', // Pass your Web3Auth Client ID, ideally using an environment variable // Get your Client ID from MetaMask Developer Dashboard

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or WEB3AUTH_NETWORK.SAPPHIRE_DEVNET

  // Core and advanced options go here

}



const web3AuthContextConfig: Web3AuthContextConfig = {

  web3AuthOptions,

}

```


### Web3AuthOptions​

| Parameter | Description |
| --- | --- |
| clientId | (Mandatory) Client ID, available from the Embedded Wallets dashboard. |
| web3AuthNetwork | (Mandatory) Web3Auth network to use for the session and the issued idToken. Default is sapphire_mainnet. |
| enableLogging? | Setting to true enables logs. Default is false. |
| sessionTime? | Session Time (in seconds) for idToken issued by Web3Auth for server side verification. Default is 7 days (7 * 86400). Max value can be 30 days (86400 * 30) and min can be 1 sec (1) |
| useSFAKey? | Uses Single Factor Auth SDK key with Web3Auth provider. Default is false. |
| storageType? | Setting to local persists social login session across browser tabs. Default is local. |
| defaultChainId? | Default chain ID to use. Your first chain will be used as default. |
| multiInjectedProviderDiscovery? | Whether to enable discovery of injected wallets in the browser. Default is true. |


## Session management​

Control how long users stay authenticated and how sessions persist.

**Key Configuration Options:**

- `sessionTime` - Session duration in seconds. Controls how long users remain authenticated before
needing to log in again.

Minimum: 1 second (`1`).
Maximum: 30 days (`86400 * 30`).
Default: 7 days (`86400 * 7`).
- `storageType` - Storage location for authentication state. Options:

`"local"`: Persists across browser tabs and browser restarts (localStorage)
`"session"`: Persists only in current tab, cleared when tab closes (sessionStorage)

- Minimum: 1 second (`1`).
- Maximum: 30 days (`86400 * 30`).
- Default: 7 days (`86400 * 7`).

- `"local"`: Persists across browser tabs and browser restarts (localStorage)
- `"session"`: Persists only in current tab, cleared when tab closes (sessionStorage)

```
const web3AuthOptions = {

  clientId: 'YOUR_WEB3AUTH_CLIENT_ID', // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,



  // Session configuration

  sessionTime: 86400 * 7, // 7 days (in seconds)

  storageType: 'local', // 'local' (persistent across tabs) or 'session' (single tab only)

}

```


## Multi-Factor Authentication (MFA)​

Add additional security layers to protect user accounts with two-factor authentication. For detailed
configuration options and implementation examples, see the [Multi-Factor Authentication](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/mfa/)
section.

**Key Configuration Options:**

- `mfaSettings` - Configure MFA settings for different authentication flows
- `mfaLevel` - Control when users are prompted to set up MFA


## Custom authentication methods​

Control the login options presented to your users and how they're displayed in the modal. For
detailed configuration options and implementation examples, see the
[custom authentication](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/custom-authentication/) section.

**Key Configuration Options:**

- `modalConfig` - Define which authentication methods are available and customize their appearance


## UI customization​

Customize the brand experience by customizing the Web3Auth Modal to match your application's
design. For complete customization options, refer to the
[whitelabeling and UI customization](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/whitelabel/) section.

**Key Configuration Options:**

- `uiConfig` - Personalize the modal's look and feel with custom colors, logos, themes, and more
- `modalConfig` - Control the visibility and arrangement of authentication options


## Smart accounts (account abstraction)​

Improve user experience with gasless transactions and advanced account features. Learn more in the
[smart accounts](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/smart-accounts/) documentation.

**Key Configuration Options:**

- `accountAbstractionConfig` - Fine-tune parameters for smart account implementation
- `useAAWithExternalWallet` - Enable account abstraction functionality even when users connect with
external wallets


## Wallet Services​

Extend your application with enhanced wallet functionality. See the
[Wallet Services](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/wallet-services/) documentation for complete configuration options.

**Key Configuration Options:**

- `walletServicesConfig` - Integrate additional Wallet Services and features

# Custom authentication

Custom authentication is a way to authenticate users with your custom authentication service. For example, while authenticating with Google, you can use your own Google Client ID to authenticate users directly.

This feature, with Multi-Factor Authentication (MFA) turned off, can make Embedded Wallets invisible to the end user.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this
SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth
Sapphire Devnet network for free.


## Getting an Auth Connection ID​

To enable this, you need to [create a connection](https://docs.metamask.io/embedded-wallets/dashboard/authentication/) from the **Authentication** tab of your project from the [Embedded Wallets developer dashboard](https://developer.metamask.io/) with your desired configuration.

To configure a connection, you need to provide the particular details of the connection into our Embedded Wallets dashboard. This enables us to map a `authConnectionId` with your connection details. This `authConnectionId` helps us to identify the connection details while initializing the SDK. You can configure multiple connections for the same project, and you can also update the connection details anytime.

Learn more about the [auth provider setup](https://docs.metamask.io/embedded-wallets/authentication/) and the different configurations available for each connection.


## Modal custom authentication​

The basic custom authentication is available directly in the modal. You can configure each of the auth providers in the modal to direct to your `authConnectionId`.

You can only configure implicit login via modal, for JWT-based logins, you need to create your own UI and use the `connectTo` function.

For the modal custom authentication, you need to pass the `modalConfig` object to the `Web3AuthOptions` object within the constructor.

Read more about the `modalConfig` object in the [Whitelabel](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/whitelabel/) section.


### Usage​

```
import { WALLET_CONNECTORS, WEB3AUTH_NETWORK } from '@web3auth/modal'

import { type Web3AuthContextConfig } from '@web3auth/modal/react'



const web3AuthContextConfig: Web3AuthContextConfig = {

  web3AuthOptions: {

    clientId: 'YOUR_WEB3AUTH_CLIENT_ID', // Pass your Web3Auth Client ID, ideally using an environment variable

    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

    modalConfig: {

      connectors: {

        [WALLET_CONNECTORS.AUTH]: {

          label: 'auth',

          loginMethods: {

            google: {

              name: 'google login',

              authConnectionId: 'w3a-google-demo',

            },

            facebook: {

              name: 'facebook login',

              authConnectionId: 'w3a-facebook-demo',

            },

            discord: {

              name: 'discord login',

              authConnectionId: 'w3a-discord-demo',

            },

            twitch: {

              name: 'twitch login',

              authConnectionId: 'w3a-twitch-demo',

            },

            twitter: {

              name: 'twitter login',

              // it will hide the twitter option from the Web3Auth modal.

              showOnModal: false,

            },

            email_passwordless: {

              name: 'email passwordless login',

              authConnectionId: 'w3a-email_passwordless-demo',

            },

            sms_passwordless: {

              name: 'sms passwordless login',

              authConnectionId: 'w3a-sms_passwordless-demo',

            },

          },

          // setting it to false will hide all social login methods from modal.

          showOnModal: true,

        },

      },

    },

  },

}



export default web3AuthContextConfig

```


## Advanced custom authentication​

The more advanced custom authentication is available via the `connectTo` function. This allows you to any service you want and tie it to your Web3Auth Integration. **This method allows you to make Web3Auth totally invisible to your end users and have a fully whitelabeled experience all across.**

You can utilise this function to enable multiple types of connections like:

- Implicit login connections
- JWT login connections
- Grouped auth connections


### Implicit logins​

Implicit logins are the easiest way to authenticate users with your custom authentication services. Web3Auth currently supports implicit logins for the following providers directly:

- Google
- Facebook
- Discord
- Twitch
- Auth0 (custom)

In addition to these you can also use any other provider (for example, Auth0, AWS Cognito, Azure AD) by providing the particular details of their login within the `extraLoginOptions` object within the `connectTo` function.


#### Usage​

```
await connectTo(WALLET_CONNECTORS.AUTH, {

  authConnection: AUTH_CONNECTION.GOOGLE,

  authConnectionId: 'w3a-google-demo',

})

```


### JWT login​

JWT login is a way to authenticate users with your custom authentication services. With this method, Web3Auth just takes into account the `idToken` passed over to the `connectTo` function and uses it to authenticate the user. You can utilise this method with any authentication service that is OAuth 2.0 Compatible.

If you have not configured on the dashboard, whether you user ID is case sensitive or not, then you need to pass the `isUserIdCaseSensitive` option to the `extraLoginOptions`.


#### Usage​

```
const loginWithGoogle = async (response: CredentialResponse) => {

  const idToken = response.credential;



  await connectTo(WALLET_CONNECTORS.AUTH, {

    authConnectionId: "w3a-google-demo",

    authConnection: AUTH_CONNECTION.GOOGLE,

    idToken,

    extraLoginOptions: {

      isUserIdCaseSensitive: false,

    },

  });

};



...



<GoogleLogin

  onSuccess={loginWithGoogle}

  onError={() => {

    console.log("Login Failed");

  }}

  useOneTap

/>

```


### Grouped auth connections​

Grouped auth connections allows you to group multiple auth connections together and use them as a single connection. This is useful when you want to authenticate the user with multiple providers and require the same user wallet address to be generated.

For example, you can group Google and email passwordless providers together and use them as a single connection. Now, if your user logs in with Google Auth or even with email passwordless using the same email, they will get the same wallet address.

You need to configure a grouped connection, by combining your single connections in the Embedded Wallets dashboard before using this feature.

```
const loginWithGoogle = async () => {

  await connectTo(WALLET_CONNECTORS.AUTH, {

    groupedAuthConnectionId: 'aggregate-sapphire',

    authConnectionId: 'w3a-google',

    authConnection: AUTH_CONNECTION.GOOGLE,

  })

}



const loginWithAuth0Google = async () => {

  await connectTo(WALLET_CONNECTORS.AUTH, {

    groupedAuthConnectionId: 'aggregate-sapphire',

    authConnectionId: 'w3a-a0-google',

    authConnection: AUTH_CONNECTION.CUSTOM,

    extraLoginOptions: {

      connection: 'google-oauth2',

    },

  })

}



const loginWithAuth0GitHub = async () => {

  await connectTo(WALLET_CONNECTORS.AUTH, {

    groupedAuthConnectionId: 'aggregate-sapphire',

    authConnectionId: 'w3a-a0-github',

    authConnection: AUTH_CONNECTION.CUSTOM,

    extraLoginOptions: {

      connection: 'github',

    },

  })

}

```

# Whitelabel

Web3Auth allows complete whitelabeling with application branding for a consistent user experience. You can customize three different aspects:

- **UI elements:** Customize the appearance of modals and components
- **Branding:** Apply your brand colors, logos, and themes
- **Translations:** Localize the interface for your users

All of these settings can be easily managed directly from the Embedded Wallets dashboard. Once you update your branding, or UI preferences there, the changes will automatically apply to your integration.

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this
SDK in a production environment is the **Growth Plan**. You can use this feature in Web3Auth
Sapphire Devnet network for free.


## Customizing the Web3Auth Modal​

While basic modal appearance can be configured directly on the dashboard, the following advanced options provide even greater control through the `modalConfig` property.


### modalConfig​

The `modalConfig` option in the constructor lets you configure the modal UI and customize authentication:

```
modalConfig?: ConnectorsModalConfig;



export interface ConnectorsModalConfig {

    connectors?: Partial<Record<WALLET_CONNECTOR_TYPE, ModalConfig>>;

    hideWalletDiscovery?: boolean;

}



export type WALLET_CONNECTOR_TYPE = (typeof WALLET_CONNECTORS)[keyof typeof WALLET_CONNECTORS];



export interface ModalConfig extends Omit<BaseConnectorConfig, "isInjected" | "chainNamespaces"> {

    loginMethods?: LoginMethodConfig;

}

```


### LoginMethodConfig​

The `LoginMethodConfig` interface provides extensive customization options for each authentication method:

| Property | Type | Description |
| --- | --- | --- |
| name | string | Custom display name (defaults to auth app's default if not provided) |
| description | string | Button description (renders as full-length button if provided; otherwise as an icon) |
| logoHover | string | Logo shown on mouse hover (defaults to auth app's default) |
| logoLight | string | Logo for dark theme/background (defaults to auth app's default) |
| logoDark | string | Logo for light theme/background (defaults to auth app's default) |
| mainOption | boolean | Whether to show login button on the main list |
| showOnModal | boolean | Controls visibility of the login button on modal |
| authConnectionId | string | Auth connection ID of the provider |
| groupedAuthConnectionId | string | Grouped Auth Connection ID of the provider |
| extraLoginOptions | ExtraLoginOptions | Additional parameters for social login |
| authConnection | AUTH_CONNECTION_TYPE | Auth connection type (useful for customizing login buttons with custom connectors) |
| isDefault | boolean | Whether it's the default connector (internal) |


## Common customization examples​


### Disabling specific social login methods​

Web3Auth provides the following social login methods:

```
export declare const AUTH_CONNECTION: {

  readonly GOOGLE: 'google'

  readonly TWITTER: 'twitter'

  readonly FACEBOOK: 'facebook'

  readonly DISCORD: 'discord'

  readonly FARCASTER: 'farcaster'

  readonly APPLE: 'apple'

  readonly GITHUB: 'github'

  readonly REDDIT: 'reddit'

  readonly LINE: 'line'

  readonly KAKAO: 'kakao'

  readonly LINKEDIN: 'linkedin'

  readonly TWITCH: 'twitch'

  readonly TELEGRAM: 'telegram'

  readonly WECHAT: 'wechat'

  readonly EMAIL_PASSWORDLESS: 'email_passwordless'

  readonly SMS_PASSWORDLESS: 'sms_passwordless'

  readonly CUSTOM: 'custom'

  readonly AUTHENTICATOR: 'authenticator'

}

```

To disable specific login methods, set `showOnModal` to `false` for the corresponding auth connection:

```
import { AUTH_CONNECTION, WALLET_CONNECTORS, WEB3AUTH_NETWORK } from '@web3auth/modal'

import { type Web3AuthContextConfig } from '@web3auth/modal/react'



const web3AuthContextConfig: Web3AuthContextConfig = {

  web3AuthOptions: {

    clientId: 'YOUR_WEB3AUTH_CLIENT_ID', // Pass your Web3Auth Client ID, ideally using an environment variable

    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

    modalConfig: {

      connectors: {

        [WALLET_CONNECTORS.AUTH]: {

          label: 'auth',

          loginMethods: {

            // Disable Facebook and Reddit

            facebook: {

              name: 'facebook',

              showOnModal: false,

            },

            reddit: {

              name: 'reddit',

              showOnModal: false,

            },

          },

          // Setting to false will hide all social login methods from modal

          showOnModal: true,

        },

      },

    },

  },

}



export default web3AuthContextConfig

```


### Enhancing email and SMS login experience​

By specifying a custom `authConnectionId` for email or SMS login methods, you can ensure the entire authentication flow takes place within the modal, eliminating the need for external popups.

In the default setup, users are redirected to a separate popup to enter their email or phone number for security purposes. However, with a custom `authConnectionId`, this input step is securely embedded directly inside the modal, keeping the input step inside the modal.

```
import { WALLET_CONNECTORS, WEB3AUTH_NETWORK } from '@web3auth/modal'

import { type Web3AuthContextConfig } from '@web3auth/modal/react'



const web3AuthContextConfig: Web3AuthContextConfig = {

  web3AuthOptions: {

    clientId: 'YOUR_WEB3AUTH_CLIENT_ID', // Pass your Web3Auth Client ID, ideally using an environment variable

    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

    modalConfig: {

      connectors: {

        [WALLET_CONNECTORS.AUTH]: {

          label: 'auth',

          loginMethods: {

            email_passwordless: {

              name: 'email passwordless login',

              authConnectionId: 'w3a-email_passwordless-demo',

            },

            sms_passwordless: {

              name: 'sms passwordless login',

              authConnectionId: 'w3a-sms_passwordless-demo',

            },

          },

        },

      },

    },

  },

}



export default web3AuthContextConfig

```


## Creating a fully custom UI​

For complete control over the authentication interface, you can bypass the Web3Auth modal entirely and use the `connectTo` function. This allows you to create custom buttons that connect directly to specific auth providers.

See the [custom authentication](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/custom-authentication/) section for detailed implementation instructions.

# Multi-factor authentication

Web3Auth supports Multi-Factor Authentication (MFA) for enhanced security. MFA requires two or more factors, such as device, social, seed phrase, or password, to access your account and recover it if needed. When a recovery factor is set up, MFA is enabled and your key is split into three shares, using Web3Auth MPC for secure, self-custodial storage.

If you are using default dashboard connections, your users may have set up MFA on other dapps that also use default Web3Auth connections. In this case, the MFA screen will continue to appear if the user has enabled MFA on other dapps. This is because MFA cannot be turned off once it is enabled.


## Multi-Factor Authentication configuration options​

There are two ways to configure MFA in your application:

1. **Using the mfaLevel setting:** Controls the frequency of the MFA setup request screen.
2. **Using the mfaSettings setting:** Provides granular control over each factor, with their priority level, enable/disable status, and mandatory/optional settings.


## mfaLevel​

The `mfaLevel` setting allows you to control when and how the MFA setup screen appears to users.

```
mfaLevel?: MfaLevelType;

```


### Multi-Factor Authentication level types​

| Level | Value | Description |
| --- | --- | --- |
| DEFAULT | "default" | MFA screen appears every 10th login |
| OPTIONAL | "optional" | MFA screen appears every login, but can be skipped |
| MANDATORY | "mandatory" | MFA setup is required after login |
| NONE | "none" | MFA setup is skipped entirely |


### Type definition​

```
export type MfaLevelType = (typeof MFA_LEVELS)[keyof typeof MFA_LEVELS]

export declare const MFA_LEVELS: {

  readonly DEFAULT: 'default'

  readonly OPTIONAL: 'optional'

  readonly MANDATORY: 'mandatory'

  readonly NONE: 'none'

}

```


### Usage examples​


### Usage​

```
import { WALLET_CONNECTORS, AUTH_CONNECTION, MFA_LEVELS } from '@web3auth/modal'



await connectTo(WALLET_CONNECTORS.AUTH, {

  authConnection: AUTH_CONNECTION.GOOGLE,

  authConnectionId: 'w3a-google-demo',

  mfaLevel: MFA_LEVELS.MANDATORY,

})

```


## mfaSettings​

This is a paid feature and the minimum [pricing plan](https://web3auth.io/pricing.html) to use this SDK in a production environment is the **Scale Plan**. You can use this feature in Web3Auth Sapphire Devnet network for free.

The `mfaSettings` option provides granular control over each individual MFA factor.

```
mfaSettings?: MfaSettings;

```


### Multi-Factor Authentication factors​

| Factor | Key | Description |
| --- | --- | --- |
| DEVICE | "deviceShareFactor" | Device-based authentication. |
| BACKUP_SHARE | "backUpShareFactor" | Backup share (typically seed phrase). |
| SOCIAL_BACKUP | "socialBackupFactor" | Social account backup. |
| PASSWORD | "passwordFactor" | Password-based authentication. |
| AUTHENTICATOR | "authenticatorFactor" | Authenticator app (TOTP). |


### Multi-Factor Authentication settings properties​

| Property | Type | Description |
| --- | --- | --- |
| enable | boolean | Whether this factor is enabled. |
| priority | number | Order in which factors are presented (lower = earlier). |
| mandatory | boolean | Whether this factor is required. |


### Type definitions​

```
export type MfaSettings = Partial<Record<MFA_FACTOR_TYPE, MFA_SETTINGS>>

export type MFA_FACTOR_TYPE = (typeof MFA_FACTOR)[keyof typeof MFA_FACTOR]

export declare const MFA_FACTOR: {

  readonly DEVICE: 'deviceShareFactor'

  readonly BACKUP_SHARE: 'backUpShareFactor'

  readonly SOCIAL_BACKUP: 'socialBackupFactor'

  readonly PASSWORD: 'passwordFactor'

  readonly PASSKEYS: 'passkeysFactor'

  readonly AUTHENTICATOR: 'authenticatorFactor'

}

export type MFA_SETTINGS = {

  enable: boolean

  priority?: number

  mandatory?: boolean

}

```


### Important rules​

- At least two factors must be enabled when setting up MFA.
- If you set `mandatory: true` for all factors, the user must set up all enabled factors.
- If you set `mandatory: false` for all factors, the user can skip setting up MFA, but at least two factors are still required.
- If you set `mandatory: true` for some factors and `mandatory: false` for others, the user must set up the mandatory factors and can optionally set up the others.
- The `priority` field determines the order of setup - lower priority values appear first.


### Usage​

```
import { MFA_FACTORWEB3AUTH_NETWORK, type Web3AuthOptions } from '@web3auth/modal'



const web3AuthOptions: Web3AuthOptions = {

  clientId: 'YOUR_WEB3AUTH_CLIENT_ID', // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  mfaSettings: {

    [MFA_FACTOR.DEVICE]: {

      enable: true,

      priority: 1,

      mandatory: true, // at least two factors are mandatory

    },

    [MFA_FACTOR.BACKUP_SHARE]: {

      enable: true,

      priority: 2,

      mandatory: true, // at least two factors are mandatory

    },

    [MFA_FACTOR.SOCIAL_BACKUP]: {

      enable: true,

      priority: 3,

      mandatory: false,

    },

    [MFA_FACTOR.PASSWORD]: {

      enable: true,

      priority: 4,

      mandatory: false,

    },

    [MFA_FACTOR.PASSKEYS]: {

      enable: true,

      priority: 5,

      mandatory: false,

    },

    [MFA_FACTOR.AUTHENTICATOR]: {

      enable: true,

      priority: 6,

      mandatory: false,

    },

  },

}



const web3AuthContextConfig = {

  web3AuthOptions,

}

```

# Wallet Services

Web3Auth Wallet Services provides a comprehensive suite of wallet functionality including fiat-on-ramp, swaps, and interoperability with WalletConnect. These services enhance your application by offering a complete wallet experience without building these features from scratch.

All these configurations can be directly accessed and managed through the [Embedded Wallets dashboard](https://developer.metamask.io/). Manual configuration in the SDK is optional and provided here for reference purposes.

Access to Wallet Services is gated. You can use this feature in `sapphire_devnet` at no cost. The minimum [pricing plan](https://web3auth.io/pricing.html) to use this feature in a production environment is the **Scale Plan**.


## walletServicesConfig​

The `walletServicesConfig` option allows you to customize the Wallet Services experience for your users.

```
walletServicesConfig?: WalletServicesConfig;

```


### Configuration options​

| Property | Type | Description |
| --- | --- | --- |
| confirmationStrategy | CONFIRMATION_STRATEGY_TYPE | How to display confirmation screens. |
| modalZIndex | number | Z-index for modal windows. |
| enableKeyExport | boolean | Enable private key export functionality. |
| whiteLabel | Object | Customization options for the widget appearance. |


#### Confirmation strategy options​

| Strategy | Description |
| --- | --- |
| default | Uses auto-approve by default, modal for WalletConnect requests. |
| modal | Always uses modal for confirmations. |
| auto-approve | Automatically approves transactions without confirmation. |


#### Whitelabel options​

| Property | Type | Description |
| --- | --- | --- |
| showWidgetButton | boolean | Whether to show the widget button. |
| buttonPosition | BUTTON_POSITION_TYPE | Position of the widget button on the page. |
| hideNftDisplay | boolean | Hide NFT display in the wallet. |
| hideTokenDisplay | boolean | Hide token display in the wallet. |
| hideTransfers | boolean | Hide transfer functionality. |
| hideTopup | boolean | Hide top-up (fiat on-ramp) functionality. |
| hideReceive | boolean | Hide receive address functionality. |
| hideSwap | boolean | Hide token swap functionality. |
| hideShowAllTokens | boolean | Hide the "show all tokens" option. |
| hideWalletConnect | boolean | Hide WalletConnect integration. |
| defaultPortfolio | "token" | "nft" | Default portfolio view. |


#### Button position options​

| Position | Description |
| --- | --- |
| bottom-left | Bottom left corner of the page. |
| top-left | Top left corner of the page. |
| bottom-right | Bottom right corner of the page. |
| top-right | Top right corner of the page. |


## Usage​

```
import {

  BUTTON_POSITION,

  CONFIRMATION_STRATEGY,

  WEB3AUTH_NETWORK,

  type Web3AuthOptions,

} from '@web3auth/modal'



const web3AuthOptions: Web3AuthOptions = {

  clientId: 'YOUR_WEB3AUTH_CLIENT_ID', // Pass your Web3Auth Client ID, ideally using an environment variable

  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,

  walletServicesConfig: {

    confirmationStrategy: CONFIRMATION_STRATEGY.MODAL,

    modalZIndex: 99999,

    enableKeyExport: false,

    whiteLabel: {

      showWidgetButton: true,

      buttonPosition: BUTTON_POSITION.BOTTOM_RIGHT,

      hideNftDisplay: false,

      hideTokenDisplay: false,

      hideTransfers: false,

      hideTopup: false,

      hideReceive: false,

      hideSwap: false,

      hideShowAllTokens: false,

      hideWalletConnect: false,

      defaultPortfolio: 'token',

    },

  },

}



const web3AuthContextConfig = {

  web3AuthOptions,

}

```

# React hooks for Ethereum (via Wagmi)

Web3Auth supports hooks based Ethereum wallet operations in React via [Wagmi](https://wagmi.sh/). Once you have set up Wagmi using the Web3Auth Modal SDK, you can use all Wagmi hooks directly in your application, no additional wrappers or configuration are needed beyond the initial setup.


## Wagmi integration​

You need to install the `wagmi` and `@tanstack/react-query` packages and use the Embedded Wallets
implementation of `WagmiProvider` for configuration.

The Embedded Wallets implementation of `WagmiProvider` is a custom implementation that is used to integrate
with the Embedded Wallets/Web3Auth Modal SDK. It is a wrapper around the `WagmiProvider` that makes it compatible.

With this implementation, you can use the Wagmi hooks, however **no external connectors are
supported**. Embedded Wallets provides a whole suite of connectors which you can use directly for a better
experience with external wallets.

```
npm install wagmi@3 @tanstack/react-query

```

```
import './index.css'



import ReactDOM from 'react-dom/client'

import { Web3AuthProvider } from '@web3auth/modal/react'

import web3AuthContextConfig from './web3authContext'

import { WagmiProvider } from '@web3auth/modal/react/wagmi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'



import App from './App'



const queryClient = new QueryClient()



ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(

  <Web3AuthProvider config={web3AuthContextConfig}>

    <QueryClientProvider client={queryClient}>

      <WagmiProvider>

        <App />

      </WagmiProvider>

    </QueryClientProvider>

  </Web3AuthProvider>

)

```

Wagmi provides a comprehensive set of React hooks for Ethereum and EVM-compatible chains. Embedded Wallets
integrates with Wagmi, so you can use hooks like `useConnection`, `useBalance`,
`useSendTransaction`, and more, out of the box.

Below are some examples of using Wagmi hooks in your dapp after Embedded Wallets and Wagmi are set up. You
can note these functions work directly with Wagmi. Once you have set up Wagmi with Embedded Wallets, you can
use any Wagmi hook as you would in a standard Wagmi application.


### Get account balance​

```
import { useConnection, useBalance } from 'wagmi'

import { formatUnits } from 'viem'



export function Balance() {

  const { address } = useConnection()

  const { data, isLoading, error } = useBalance({ address })



  return (

    <div>

      <h2>Balance</h2>

      <div>

        {data?.value !== undefined && `${formatUnits(data.value, data.decimals)} ${data.symbol}`}{' '}

        {isLoading && 'Loading...'} {error && 'Error: ' + error.message}

      </div>

    </div>

  )

}

```


### Send transaction​

```
import { FormEvent } from 'react'

import { useWaitForTransactionReceipt, useSendTransaction, BaseError } from 'wagmi'

import { Hex, parseEther } from 'viem'



export function SendTransaction() {

  const { data: hash, error, isPending, sendTransaction } = useSendTransaction()



  async function submit(e: FormEvent<HTMLFormElement>) {

    e.preventDefault()

    const formData = new FormData(e.target as HTMLFormElement)

    const to = formData.get('address') as Hex

    const value = formData.get('value') as string

    sendTransaction({ to, value: parseEther(value) })

  }



  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({

    hash,

  })



  return (

    <div>

      <h2>Send Transaction</h2>

      <form onSubmit={submit}>

        <input name="address" placeholder="Address" required />

        <input name="value" placeholder="Amount (ETH)" type="number" step="0.000000001" required />

        <button disabled={isPending} type="submit">

          {isPending ? 'Confirming...' : 'Send'}

        </button>

      </form>

      {hash && <div>Transaction Hash: {hash}</div>}

      {isConfirming && 'Waiting for confirmation...'}

      {isConfirmed && 'Transaction confirmed.'}

      {error && <div>Error: {(error as BaseError).shortMessage || error.message}</div>}

    </div>

  )

}

```


### Switch chain​

```
import { useChainId, useChains, useSwitchChain } from 'wagmi'



export function SwitchChain() {

  const chainId = useChainId()

  const chains = useChains()

  const { switchChain, error } = useSwitchChain()



  return (

    <div>

      <h2>Switch Chain</h2>

      <h3>Connected to {chainId}</h3>

      {chains.map(chain => (

        <button

          disabled={chainId === chain.id}

          key={chain.id}

          onClick={() => switchChain({ chainId: chain.id })}

          type="button"

          className="card">

          {chain.name}

        </button>

      ))}

      {error?.message}

    </div>

  )

}

```

