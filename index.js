// Critical polyfills for Firebase in React Native must come first
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Base64 polyfills for atob/btoa expected by some Firebase internals
import { decode as atobPolyfill, encode as btoaPolyfill } from 'base-64';
if (!global.btoa) global.btoa = btoaPolyfill;
if (!global.atob) global.atob = atobPolyfill;

// Ensure global.self exists (Firebase checks for self in some environments)
if (typeof global.self === 'undefined') global.self = global;

// Ensure Buffer exists
import { Buffer } from 'buffer';
if (!global.Buffer) global.Buffer = Buffer;

// Provide a minimal process.env
if (!global.process) global.process = {};
if (!global.process.env) global.process.env = {};

import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';

// Register with Expo so it works in managed workflow
registerRootComponent(App);

