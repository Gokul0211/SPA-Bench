import { useState } from 'react';
export function useAuth() { return { token: null, login: async() => {}, logout: () => {} }; }
