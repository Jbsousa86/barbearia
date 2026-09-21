import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCzuJcizPL42A-UQuaSEijBRSjIqf9EKNA",
  authDomain: "barbearia-3e0ef.firebaseapp.com",
  projectId: "barbearia-3e0ef",
  storageBucket: "barbearia-3e0ef.firebasestorage.app",
  messagingSenderId: "378618850494",
  appId: "1:378618850494:web:0b1ad9498c611ce40b02ef",
  measurementId: "G-L7TPXMWX15"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
