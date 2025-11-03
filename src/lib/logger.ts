import * as fs from "fs";
import * as path from "path";
import { ILogObj, Logger } from "tslog";
import { ZodError } from "zod";

// Détection de l'environnement
const isDev = process.env.NODE_ENV !== "production";
const isTest = process.env.NODE_ENV === "test";

console.log({ idDev: isDev });

// Configuration du logger principal
export const logger = new Logger<ILogObj>({
  name: "App",

  // Niveaux de log
  minLevel: isDev ? 0 : 3, // 0=silly, 1=trace, 2=debug, 3=info, 4=warn, 5=error, 6=fatal

  // ✨ Affichage en DEV (coloré et lisible)
  type: isDev ? "pretty" : "json",

  // ✨ Format date/heure
  prettyLogTimeZone: "local",
  prettyLogTemplate: "{{hh}}:{{MM}}:{{ss}}.{{ms}} {{logLevelName}} {{name}} ",

  // ✨ Couleurs personnalisées
  stylePrettyLogs: true,
  prettyLogStyles: {
    logLevelName: {
      "*": ["bold", "black", "bgWhiteBright", "dim"],
      SILLY: ["bold", "white"],
      TRACE: ["bold", "whiteBright"],
      DEBUG: ["bold", "cyan"],
      INFO: ["bold", "blue"],
      WARN: ["bold", "yellow"],
      ERROR: ["bold", "red"],
      FATAL: ["bold", "redBright"],
    },
    dateIsoStr: "white",
    filePathWithLine: "white",
    name: ["white", "bold"],
    nameWithDelimiterPrefix: ["white", "bold"],
    nameWithDelimiterSuffix: ["white", "bold"],
    errorName: ["bold", "bgRedBright", "whiteBright"],
    fileName: ["yellow"],
  },

  // ✨ Masquer certains champs en dev
  hideLogPositionForProduction: !isDev,
});

// ===================================
// Sous-loggers avec icônes et couleurs
// ===================================

export const wsLogger = logger.getSubLogger({
  name: "🔌 WebSocket",
});

export const duckDbLogger = logger.getSubLogger({
  name: "🦆 DuckDB",
});

export const pgDbLogger = logger.getSubLogger({
  name: "🐘 Postgres",
});

export const apiLogger = logger.getSubLogger({
  name: "🌐 API",
});

export const cacheLogger = logger.getSubLogger({
  name: "💾 Cache",
});

// ===================================
// Logs fichier en production
// ===================================

if (!isDev && !isTest) {
  const allLoggers = [
    logger,
    wsLogger,
    duckDbLogger,
    pgDbLogger,
    apiLogger,
    cacheLogger,
  ];

  const logsDir = path.join(process.cwd(), "logs");

  // Créer le dossier logs s'il n'existe pas
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().split("T")[0];

  // Stream pour tous les logs
  const allLogsStream = fs.createWriteStream(
    path.join(logsDir, `app-${dateStr}.log`),
    { flags: "a" },
  );

  // Stream pour les erreurs uniquement
  const errorLogsStream = fs.createWriteStream(
    path.join(logsDir, `error-${dateStr}.log`),
    { flags: "a" },
  );

  allLoggers.forEach((loggerInstance) => {
    loggerInstance.attachTransport((logObj) => {
      try {
        // Sérialiser avec replacer pour gérer les erreurs
        const logLine =
          JSON.stringify(logObj, (key, value) => {
            if (value instanceof Error) {
              return {
                name: value.name,
                message: value.message,
                stack: value.stack,
              };
            }
            return value;
          }) + "\n";

        allLogsStream.write(logLine);

        // Écrire aussi dans error.log si ERROR ou FATAL
        if (logObj._meta?.logLevelId >= 5) {
          errorLogsStream.write(logLine);
        }
      } catch (err) {
        console.error("❌ Failed to write log:", err);
      }
    });
  });

  // Fermer les streams proprement
  const closeStreams = () => {
    allLogsStream.end();
    errorLogsStream.end();
  };

  process.on("beforeExit", closeStreams);
  process.on("SIGINT", closeStreams);
  process.on("SIGTERM", closeStreams);
}

// ===================================
// Helpers pour logs structurés
// ===================================

/**
 * Formatte une ZodError en structure lisible
 */
const formatZodError = (error: ZodError) => {
  return {
    type: "ZodError",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
      expected: "expected" in issue ? issue.expected : undefined,
      received: "received" in issue ? issue.received : undefined,
    })),
    summary: error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(" | "),
  };
};

/**
 * Formatte une erreur Drizzle ORM
 */
const formatDrizzleError = (error: any) => {
  return {
    type: "DrizzleError",
    message: error.message,
    code: error.code,
    detail: error.detail,
    hint: error.hint,
    position: error.position,
  };
};

/**
 * Formatte une erreur PostgreSQL
 */
const formatPostgresError = (error: any) => {
  return {
    type: "PostgresError",
    message: error.message,
    code: error.code,
    severity: error.severity,
    detail: error.detail,
    hint: error.hint,
    position: error.position,
    schema: error.schema,
    table: error.table,
    column: error.column,
    constraint: error.constraint,
  };
};

/**
 * Log une requête HTTP
 */
export const logRequest = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, any>,
) => {
  const level =
    statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

  apiLogger[level]({
    msg: `${method} ${path} ${statusCode} ${duration}ms`,
    method,
    path,
    statusCode,
    duration,
    ...metadata,
  });
};

/**
 * Log une query DB avec durée
 */
export const logQuery = (
  logger: Logger<ILogObj>,
  query: string,
  duration: number,
  rowCount?: number,
) => {
  const truncatedQuery =
    query.length > 100 ? query.substring(0, 100) + "..." : query;

  logger.debug({
    msg: `Query executed in ${duration}ms`,
    query: truncatedQuery,
    duration,
    rowCount,
  });
};

/**
 * Log une erreur avec contexte enrichi
 * Gère automatiquement ZodError, DrizzleError, PostgresError, et Error standard
 */
export const logError = (
  logger: Logger<ILogObj>,
  error: Error | ZodError | unknown,
  context?: Record<string, any>,
) => {
  if (error instanceof ZodError) {
    const formattedError = formatZodError(error);

    logger.error({
      msg: `Validation error: ${formattedError.summary}`,
      error: formattedError,
      ...context,
    });
    return;
  }

  if (error instanceof Error) {
    if ("code" in error && "severity" in error) {
      logger.error({
        msg: error.message,
        error: formatPostgresError(error),
        ...context,
      });
      return;
    }

    logger.error({
      msg: error.message,
      error: {
        name: error.name,
        message: error.message,
        stack: isDev ? error.stack : undefined,
        // Inclure des propriétés custom si présentes
        ...("code" in error && { code: (error as any).code }),
        ...("statusCode" in error && { statusCode: (error as any).statusCode }),
      },
      ...context,
    });
    return;
  }

  logger.error({
    msg: String(error),
    error: {
      type: typeof error,
      value: error,
    },
    ...context,
  });
};

/**
 * Log performance (pour benchmarks)
 */
export const logPerformance = (
  logger: Logger<ILogObj>,
  operation: string,
  duration: number,
  metadata?: Record<string, any>,
) => {
  const level = duration > 1000 ? "warn" : duration > 100 ? "info" : "debug";

  logger[level]({
    msg: `⏱️  ${operation} took ${duration}ms`,
    operation,
    duration,
    ...metadata,
  });
};

// ===================================
// Utilitaires
// ===================================

/**
 * Crée un timer pour mesurer la durée
 */
export const createTimer = () => {
  const start = performance.now();
  return {
    end: () => Math.round(performance.now() - start),
  };
};

/**
 * Middleware pour logger toutes les requêtes non-catchées
 */
export const setupGlobalErrorHandlers = () => {
  process.on("uncaughtException", (error: Error) => {
    logger.fatal({
      msg: "Uncaught Exception",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: any) => {
    logger.fatal({
      msg: "Unhandled Promise Rejection",
      reason: String(reason),
    });
    process.exit(1);
  });
};
