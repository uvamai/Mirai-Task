import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthState {
  accessToken: string | null;
  tenantId: string | null;
}

const initialState: AuthState = {
  accessToken: localStorage.getItem('mirai_access_token'),
  tenantId: localStorage.getItem('mirai_tenant_id'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(
      state,
      action: PayloadAction<{ accessToken: string; tenantId: string | null; refreshToken?: string }>
    ) {
      state.accessToken = action.payload.accessToken;
      state.tenantId = action.payload.tenantId;
      localStorage.setItem('mirai_access_token', action.payload.accessToken);
      if (action.payload.tenantId) {
        localStorage.setItem('mirai_tenant_id', action.payload.tenantId);
      }
      if (action.payload.refreshToken) {
        localStorage.setItem('mirai_refresh_token', action.payload.refreshToken);
      }
    },
    clearSession(state) {
      state.accessToken = null;
      state.tenantId = null;
      localStorage.removeItem('mirai_access_token');
      localStorage.removeItem('mirai_tenant_id');
      localStorage.removeItem('mirai_refresh_token');
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;
