// src/plugins/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5210/api', // .NET API adresin
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;
