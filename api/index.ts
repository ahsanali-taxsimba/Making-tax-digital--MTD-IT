import express, { Request, Response } from "express";
import { createNestApp } from "../src/create-app";

const server = express();
let ready: Promise<void> | undefined;

async function bootstrap(): Promise<void> {
  const app = await createNestApp(server);
  await app.init();
}

export default async function handler(req: Request, res: Response): Promise<void> {
  ready ??= bootstrap();
  await ready;
  server(req, res);
}
