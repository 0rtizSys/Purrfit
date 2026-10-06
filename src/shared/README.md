# shared: lo que el bot publica para otros servicios

Este directorio contiene lo que el bot expone hacia fuera. El sitio web vive en otro repositorio y no forma parte de este.

| Archivo              | Qué hace                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `market_worker.ts`   | Cada 2 min llama a `listMarket()` (la misma función de `/crypto market`) y escribe `data/market.json`. |
| `market_snapshot.ts` | Formato del snapshot, ruta y escritura atómica.                                                        |

Además, el bot escribe su estado de salud en la tabla `bot_heartbeat` (`src/bot/services/heartbeat.ts`, migración `003`). Quien necesite saber si el bot está vivo debe leer ese latido, no suponerlo.

```bash
npm run build
npm run worker:market   # necesita DATABASE_URL
```
