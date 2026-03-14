# Ludo Server

Backend server for the Ludo multiplayer game.

## API Endpoints

### Health Check

```
GET /api/health
```

Returns server status and statistics.

### Room Info

```
GET /api/room/:code
```

Get information about a specific room (for debugging).

## Socket Events

### Client → Server

#### `create_room`

Create a new game room.

```javascript
{
  username: string,
  avatar: string,
  playerCount: number (2 or 4)
}
```

#### `join_room`

Join an existing room.

```javascript
{
  roomCode: string,
  username: string,
  avatar: string
}
```

#### `player_ready`

Toggle player ready status.

```javascript
{
  ready: boolean;
}
```

#### `start_game`

Start the game (host only).

```javascript
{
}
```

#### `roll_dice`

Roll the dice on your turn.

```javascript
{
}
```

#### `move_token`

Move a token.

```javascript
{
  tokenIndex: number;
}
```

#### `leave_room`

Leave the current room.

```javascript
{
}
```

#### `chat_message`

Send a chat message.

```javascript
{
  message: string;
}
```

### Server → Client

#### `player_joined`

A player joined the room.

```javascript
{
  room: Room;
}
```

#### `player_left`

A player left the room.

```javascript
{
  room: Room;
}
```

#### `player_ready_update`

Player ready status changed.

```javascript
{
  room: Room;
}
```

#### `game_started`

Game has started.

```javascript
{
  gameState: GameState;
}
```

#### `dice_rolled`

Dice was rolled.

```javascript
{
  playerIndex: number,
  value: number,
  movesAvailable: Move[],
  hasExtraTurn: boolean
}
```

#### `token_moved`

A token was moved.

```javascript
{
  playerIndex: number,
  tokenIndex: number,
  newPosition: number,
  capturedToken: Capture | null,
  hasExtraTurn: boolean,
  gameState: GameState
}
```

#### `game_ended`

Game has ended with a winner.

```javascript
{
  winner: number,
  winnerData: Player
}
```

#### `player_disconnected`

A player disconnected.

```javascript
{
  room: Room;
}
```

#### `player_reconnected`

A player reconnected.

```javascript
{
  room: Room;
}
```

#### `chat_message`

Chat message received.

```javascript
{
  username: string,
  avatar: string,
  message: string,
  timestamp: number
}
```

## Data Structures

### Room

```javascript
{
  code: string,
  hostId: string,
  playerCount: number,
  players: Player[],
  gameStarted: boolean,
  gameEnded: boolean,
  createdAt: number,
  currentTurn: number
}
```

### Player

```javascript
{
  socketId: string,
  username: string,
  avatar: string,
  color: string,
  playerIndex: number,
  ready: boolean,
  connected: boolean
}
```

### GameState

```javascript
{
  players: PlayerState[],
  currentPlayerIndex: number,
  diceValue: number | null,
  movesAvailable: Move[],
  gameStarted: boolean,
  gameEnded: boolean
}
```

### Token

```javascript
{
  id: number,
  position: number,
  inBase: boolean,
  inHome: boolean,
  onBoard: boolean
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production mode
npm start

# Deploy with PM2
npm run prod
```

## Environment Variables

See `.env.example` for required configuration.
