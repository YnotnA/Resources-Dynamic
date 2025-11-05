# DyingStar Resources Dynamic Service

## Local Development

### Requirements

- [Docker](https://www.docker.com/get-started) OR [Podman](https://podman.io/)
- [Docker Compose](https://docs.docker.com/compose/install/) OR [Podman Compose](https://docs.podman.io/en/latest/markdown/podman-compose.1.html)
- [Make](https://www.gnu.org/software/make/) to use the provided Makefile

## Setup

Copy `.env.example` to `.env` and fill in the required environment variables

### Change DuckDB file

The default folder containing the duckDb database is `data` at root. Path is define in .env file `DUCKDB_PATH`.

**You must leave the `/app` because it's the docker volume**.

```shell
// Example for data folder at root
DUCKDB_PATH=/app/data/my-db.duckdb
```

### Development

1. Run `make up` This will start containers Postgres + Node (use for `make pnpm` command).
2. Run `make pnpm i` to install dependencies.
3. Run `make db-migrate` to execute migration scripts.
4. Run `make pnpm dev` to start development server.
5. To stop the server, stop the Docker container with `make down`.

### Testing

1. Run `make start` to start the server. This will install dependencies, start containers and execute migration scripts.
2. To stop the server, stop the Docker container with `Ctrl+C` in the terminal where `make start` was run.

## WebSocket

- All requests message **must be encoded** with [msgpack](https://msgpack.org/)
- All responses message are encoded with [msgpack](https://msgpack.org/)

### Message "Connected"

Message received after connection

#### Response :

```JSON
{
    type: "connected";
    clientId: string; // Generated dynamically upon connection
    timestamp: number;
}
```

---

### Message "Ping"

Used to ping the server

#### Request :

```JSON
{
  action: "ping",
}
```

#### Response :

```JSON
{
    type: "pong";
    timestamp: number;
}
```

---

### Message "Init"

Used to retrieve all information concerning stellar objects, including their position and rotation at T0.

#### Request :

```JSON
{
  action: "init",
}
```

#### Response :

```JSON
{
    type: "init";
    data: {
        uuid: string;
        name: string;
        internalName: string;
        position: {
            x: number;
            y: number;
            z: number;
        };
        rotation: {
            x: number;
            y: number;
            z: number;
        };
    }[];
}
```

---

### Message "Next-ticks"

Used to retrieve the position of a stellar object by UUID, specifying the start time and the number of ticks.

#### Request :

```JSON
{
    action: "next-ticks";
    target: string; // uuid
    fromTime: number; // time
    count: number; // number of ticks
}
```

#### Response :

```JSON
{
    type: "next-ticks";
    data: {
        uuid: string;
        position: {
            x: number;
            y: number;
            z: number;
        };
        rotation: {
            x: number;
            y: number;
            z: number;
        };
        time: number;
    }[];
}
```

## Notes

- The development server supports hot-reloading, so any changes you make to the code will automatically be reflected in the terminal.
- If you need to install new dependencies, you can do so by running `make pnpm add <package-name>` or `make pnpm "add -D <package-name>"` for dev dependencies.

## API Rest

To make API calls, a collection for [Bruno](https://www.usebruno.com/) software is available in the `.bruno` directory at root.

![api_rest_endpoints](documentation/assets/api_rest_endpoints.png)

All endpoints contain an example :

![api_rest_endpoints_example](documentation/assets/api_rest_endpoints_example.png)

---

🧙‍♂️ Straight outta the cave — with love ❤️
