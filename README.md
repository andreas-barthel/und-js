# UND Mainchain JavaScript SDK

The UND Mainchain JavaScript SDK allows browsers and node.js clients to 
interact with UND Mainchain. It includes the following core components:

* **crypto** - core cryptographic functions.
* **client** - implementations of UND Mainchain transaction types, such as for transfers and enterprise.
* **accounts** - management of "accounts" and wallets, including seed and encrypted mnemonic generation.

# Installation

Important, please follow the instructions for your OS below:

**Windows users:** Please install [windows-build-tools](https://www.npmjs.com/package/windows-build-tools) first.

**Mac users:** Make sure XCode Command Line Tools are installed: `xcode-select --install`.

**Linux users:** Note that Ubuntu Xenial and newer distributions are 
recommended, especially when using Travis or other CI systems. You may
 need some dev packages to be installed on your system for USB support. 
 On Debian-based distributions (like Ubuntu) you should install them 
 with this command:
 
```bash
$ sudo apt-get install libudev-dev libusb-dev usbutils
```

### Install the NPM package

```bash
$ npm i @unification-com/und-js --no-optional
```

### Use with Webpack

We often see Webpack builds failing with the SDK due to the `usb` 
dependency, but adding this to your Webpack config should fix that:

```js
module.exports = {
  plugins: [new webpack.IgnorePlugin(/^usb$/)]
}
```
or
```js
config.plugins.push(new webpack.IgnorePlugin(/^usb$/))
```

# API

For up-to-date API documentation, please check the 
[wiki](https://github.com/unification-com/und-js/wiki).

# Testing

Tests are currently run against the
[UND Mainchain DevNet](https://github.com/unification-com/mainchain/blob/master/docs/local-devnet.md)

All new code changes should be covered with unit tests. 
You can run the tests with the following command:

```bash
$ npm run test
```

# Contributing

Contributions to the UND Mainchain JavaScript SDK are welcome. Please 
ensure that you have tested the changes with a local client and have 
added unit test coverage for your code.
