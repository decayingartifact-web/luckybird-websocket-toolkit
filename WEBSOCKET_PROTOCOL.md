# LuckyBird WebSocket Protocol Documentation

## Overview

This document provides a comprehensive analysis of the LuckyBird WebSocket communication protocol based on reverse engineering efforts. The protocol uses AES-CBC encryption for message security and follows a structured JSON format for all communications.

## Connection Details

- **WebSocket URL**: `wss://luckybird.io/websocket` (inferred)
- **Protocol**: WebSocket over TLS
- **Encryption**: AES-CBC with PKCS#7 padding
- **Key**: `Luckybird1234567` (16-byte ASCII string)
- **IV**: 32-character hexadecimal string (16 bytes)
- **Payload Encoding**: Base64 with URL encoding

## Message Structure

### Encrypted Messages

All sensitive communications are encrypted using the following structure:

```json
{
  "iv": "32-character-hex-string",
  "detail": "base64-url-encoded-encrypted-payload"
}
```

### Decrypted Message Format

Once decrypted, all messages follow this standard format:

```json
{
  "code": 1234,
  "data": {
    // Message-specific data object
  }
}
```

## Encryption Process

### Encryption Steps
1. Convert message to JSON string
2. Generate random 16-byte IV
3. Encrypt JSON using AES-CBC with the hardcoded key
4. Convert IV to 32-character hex string
5. Encode encrypted payload as Base64
6. URL-encode the Base64 string
7. Send as `{iv, detail}` object

### Decryption Steps
1. Extract `iv` and `detail` from received message
2. Convert hex IV to bytes
3. URL-decode and Base64-decode the detail
4. Decrypt using AES-CBC with the known key
5. Parse resulting JSON

## Message Types

Based on observed traffic, the following message codes have been identified:

### Authentication & Connection (1000-1999)
- **1080**: Authentication - User login/session validation

### System Messages (3000-3099)
- **3022**: Connection Status - WebSocket connection state
- **3029**: Settings Update - User preference changes
- **3030**: System Message - Server announcements

### Game State (3100-3199)
- **3120**: Heartbeat/Ping - Keep-alive messages
- **3117**: Notification - In-game notifications

### User Actions (3500-3599)
- **3505**: Achievement - Achievement unlocked
- **3513**: Bet Confirmation - Bet placement confirmation
- **3547**: Game State Update - Real-time game state changes
- **3555**: Balance Update - User balance changes
- **3574**: Leaderboard - Leaderboard updates
- **3599**: Player Action Response - Response to player actions

### Chat & Social (3050-3099)
- **3052**: Room Update - Chat room state changes
- **3053**: Chat Message - User chat messages
- **3078**: User Status - Online/offline status updates

### Game Results (3700-3999)
- **3700**: Bonus/Reward - Bonus payouts and rewards
- **3803**: Game History - Historical game data
- **3951**: Game Result - Final game outcomes

### Transactions (4000-4099)
- **4020**: Transaction Update - Financial transaction status
- **4033**: Error Response - Error messages and codes

## Sample Messages

### Heartbeat Message (Code 3120)
```json
{
  "code": 3120,
  "data": {
    "timestamp": 1691234567890,
    "server_time": "2023-08-05T12:34:56Z"
  }
}
```

### Balance Update (Code 3555)
```json
{
  "code": 3555,
  "data": {
    "balance": 1250.50,
    "currency": "USD",
    "change": -50.00,
    "reason": "bet_placed"
  }
}
```

### Game Result (Code 3951)
```json
{
  "code": 3951,
  "data": {
    "game_id": "dice_12345",
    "result": "win",
    "payout": 100.00,
    "multiplier": 2.0,
    "details": {
      "roll": 65,
      "target": 50,
      "direction": "over"
    }
  }
}
```

### Error Response (Code 4033)
```json
{
  "code": 4033,
  "data": {
    "error_code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance for this bet",
    "required": 100.00,
    "available": 75.50
  }
}
```

## Traffic Patterns

### Message Frequency
- **High Frequency** (>10/sec): 3120 (Heartbeat), 3547 (Game State)
- **Medium Frequency** (1-10/sec): 3555 (Balance), 3599 (Actions)
- **Low Frequency** (<1/sec): 3951 (Results), 4020 (Transactions)

### Typical Session Flow
1. **Connection**: WebSocket established
2. **Authentication**: Code 1080 with user credentials
3. **Heartbeat**: Regular 3120 messages every 30 seconds
4. **Game Interaction**: 3513 → 3547 → 3951 sequence
5. **Balance Updates**: 3555 after each transaction

## Security Considerations

### Vulnerabilities Identified
- **Hardcoded Key**: The AES key is embedded in client-side code
- **Predictable IV**: IV generation method not analyzed but should be random
- **No Message Authentication**: No HMAC or signature verification
- **Replay Attacks**: No timestamp or nonce validation observed

### Recommendations
- Implement proper key exchange mechanism
- Add message authentication codes (MAC)
- Include timestamp validation
- Use secure random IV generation

## Implementation Notes

### Client-Side Encryption
The encryption is handled client-side in JavaScript using the Web Crypto API:

```javascript
const key = await crypto.subtle.importKey(
  "raw", 
  new TextEncoder().encode("Luckybird1234567"), 
  { name: "AES-CBC" }, 
  false, 
  ["encrypt", "decrypt"]
);
```

### Error Handling
- Failed decryption attempts are logged but don't break the connection
- Invalid JSON messages are silently ignored
- Connection drops trigger automatic reconnection

## Reverse Engineering Tools

### Tampermonkey Script
The provided userscript intercepts and decrypts messages in real-time:
- Overrides native WebSocket constructor
- Automatically detects encrypted messages
- Provides statistics and message categorization

### Dashboard Interface
Web-based dashboard for analysis:
- Real-time message monitoring
- Message type categorization
- Export functionality for further analysis
- Custom message sending capabilities

## Future Research

### Areas for Investigation
- **Server-Side Validation**: How server validates client messages
- **Rate Limiting**: Connection throttling and abuse prevention
- **Game Logic**: Detailed analysis of game-specific protocols
- **Anti-Cheat**: Detection mechanisms for modified clients

### Potential Exploits
- **Message Replay**: Replaying successful bet messages
- **Balance Manipulation**: Attempting to modify balance update messages
- **Game State Injection**: Injecting favorable game states

## Changelog

- **v1.0** (2024-01-XX): Initial protocol analysis
- **v1.1** (2024-01-XX): Added message type categorization
- **v1.2** (2024-01-XX): Enhanced security analysis

## Legal Disclaimer

This documentation is for educational and security research purposes only. Any use of this information for unauthorized access, fraud, or other illegal activities is strictly prohibited. Always comply with applicable laws and terms of service.

---

*Last Updated: January 2024*
*Research Team: WebSocket Reverse Engineering Project*
