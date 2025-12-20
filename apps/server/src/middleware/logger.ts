import type { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Log request
  console.log(`[${timestamp}] ${req.method} ${req.path}`, {
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get("user-agent"),
    ...(req.body && Object.keys(req.body).length > 0 && { body: req.body }),
    ...(req.query && Object.keys(req.query).length > 0 && { query: req.query }),
  });

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? "🔴" : res.statusCode >= 300 ? "🟡" : "🟢";
    
    console.log(
      `${statusColor} [${timestamp}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
  });

  next();
}

