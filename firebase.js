import { initializeApp } from "firebase/app";

const firebaseConfig = {
    apiKey: "AIzaSyCMOBfLbC-BJnOhv5HnQCCh1oxUdEBl93I",
    authDomain: "ez-programming.firebaseapp.com",
    projectId: "ez-programming",
    storageBucket: "ez-programming.firebasestorage.app",
    messagingSenderId: "904672440138",
    appId: "1:904672440138:web:0373f911dedfd3f02cdbb3"
};

const app = initializeApp(firebaseConfig);

export default app;