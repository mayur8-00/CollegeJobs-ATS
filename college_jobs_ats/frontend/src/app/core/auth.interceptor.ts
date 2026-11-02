import { HttpInterceptorFn } from "@angular/common/http";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isAuthRequest =
    req.url.includes("/api/auth/login") || req.url.includes("/api/auth/token");

  if (isAuthRequest) {
    return next(req);
  }

  const token = localStorage.getItem("access_token");

  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(authReq);
};
