type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      data
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // Em produção, só loga erros
    if (!this.isDevelopment) {
      return level === 'error';
    }
    // Em desenvolvimento, loga tudo
    return true;
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      const entry = this.formatMessage('info', message, data);
      console.log(`[INFO] ${entry.timestamp}: ${message}`, data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      const entry = this.formatMessage('warn', message, data);
      console.warn(`[WARN] ${entry.timestamp}: ${message}`, data || '');
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      const entry = this.formatMessage('error', message, data);
      console.error(`[ERROR] ${entry.timestamp}: ${message}`, data || '');
      
      // TODO: Enviar para serviço de monitoramento em produção
      // if (!this.isDevelopment) {
      //   Sentry.captureException(new Error(message), { extra: data });
      // }
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      const entry = this.formatMessage('debug', message, data);
      console.debug(`[DEBUG] ${entry.timestamp}: ${message}`, data || '');
    }
  }
}

export const logger = new Logger();