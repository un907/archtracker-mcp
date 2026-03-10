import { Timestamp } from './types';
export enum LogLevel { DEBUG, INFO, WARN, ERROR }
export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {}
export function debug(msg: string) { log(LogLevel.DEBUG, msg); }
export function info(msg: string) { log(LogLevel.INFO, msg); }
export function warn(msg: string) { log(LogLevel.WARN, msg); }
export function error(msg: string, err?: Error) { log(LogLevel.ERROR, msg, { err }); }
