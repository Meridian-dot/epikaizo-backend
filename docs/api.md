# Epikaizo API contract

Base URL: `http://localhost:4000` locally; staging is `https://epikaizo-backend.onrender.com`.
All requests and responses are JSON. Dates are `YYYY-MM-DD`, times are `HH:MM`, prices are Namibian dollars as numbers.

**Status key:** Live = working now. Planned = shape agreed, not built yet. Build against the example JSON with mock data until it goes live.

## Errors

Every error has the same shape and a matching HTTP status:

```json
{ "error": { "code": "not_found", "message": "Room not found" } }
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `invalid_input` | A field is missing or wrong; `fields` lists each problem |
| 400 | `invalid_json` | Body is not valid JSON |
| 401 | `not_logged_in` | Admin route without a valid session (planned) |
| 403 | `forbidden` | Logged in but the role is not allowed (planned) |
| 404 | `not_found` | Unknown route or record |
| 409 | `unavailable` | The room or table slot was taken in the meantime (planned) |
| 500 | `server_error` | Bug on our side |

`invalid_input` example:

```json
{
  "error": {
    "code": "invalid_input",
    "message": "Some fields are invalid",
    "fields": { "email": ["Invalid email address"] }
  }
}
```

## Public endpoints

### `GET /health` and `GET /health/db` (Live)

```json
{ "status": "ok", "database": "reachable" }
```

### `GET /rooms` (Live)

Active room types in display order.

```json
[
  {
    "id": 3,
    "name": "Family Suite",
    "slug": "family-suite",
    "description": "A queen bed and two singles with a small lounge.",
    "pricePerNight": 1450,
    "maxGuests": 4,
    "amenities": [{ "id": 1, "name": "Free Wi-Fi", "icon": "wifi" }],
    "photos": [{ "id": 4, "url": "https://…", "alt": "Family Suite" }]
  }
]
```

### `GET /rooms/:slug` (Live)

One room type, same shape as an item above. 404 if the slug does not exist or the room is hidden.

### `GET /rooms/:id/availability?from=2026-12-20&to=2026-12-27` (Planned, Tue 1 Dec)

Rooms left for each night from `from` up to, not including, `to`. A night with `available: 0` is full.

```json
{
  "roomTypeId": 3,
  "nights": [
    { "date": "2026-12-20", "available": 2 },
    { "date": "2026-12-21", "available": 0 }
  ]
}
```

### `POST /bookings/rooms` (Planned, Sat 5 Dec)

Request:

```json
{
  "roomTypeId": 3,
  "checkIn": "2026-12-20",
  "checkOut": "2026-12-23",
  "guests": 3,
  "guestName": "Maria Shikongo",
  "email": "maria@example.com",
  "phone": "+264 81 123 4567",
  "notes": "Arriving late"
}
```

Response `201`:

```json
{ "reference": "EPK-R-7K3Q9", "status": "pending", "expiresAt": "2026-12-01T10:00:00Z" }
```

`409 unavailable` if any night became full before the request was saved.

### `GET /menu` (Live)

```json
[
  {
    "id": 2,
    "name": "Mains",
    "items": [
      {
        "id": 4,
        "name": "Vegetable curry",
        "description": "…",
        "price": 135,
        "dietaryTags": ["vegetarian", "vegan"],
        "isAvailable": true,
        "photo": null
      }
    ]
  }
]
```

Items with `isAvailable: false` are included so the page can show them as unavailable.

### `GET /restaurant/slots?date=2026-12-20` (Planned, Mon 7 Dec)

```json
{
  "date": "2026-12-20",
  "slots": [
    { "time": "11:00", "seatsLeft": 20 },
    { "time": "11:30", "seatsLeft": 6 }
  ]
}
```

### `POST /bookings/tables` (Planned, Mon 7 Dec)

Request:

```json
{
  "date": "2026-12-20",
  "timeSlot": "19:00",
  "partySize": 4,
  "guestName": "Maria Shikongo",
  "email": "maria@example.com",
  "phone": "+264 81 123 4567",
  "notes": ""
}
```

Response `201`: `{ "reference": "EPK-T-4M8XZ", "status": "pending" }`. `409 unavailable` if the slot no longer has enough seats.

### `GET /content/:key` (Live)

`key` is `home`, `about` or `contact`.

```json
{ "key": "about", "title": "About us", "body": "…", "updatedAt": "2026-11-24T10:18:39.790Z" }
```

### `POST /contact` (Planned, Mon 30 Nov)

Request: `{ "name": "…", "email": "…", "phone": "…", "message": "…" }`. Response `202`: `{ "sent": true }`.

## Admin endpoints (Planned)

All need a logged-in session (httpOnly cookie set by `POST /auth/login`). The frontend must send requests with `credentials: "include"`.

| Method and path | Role | Purpose | Due |
| --- | --- | --- | --- |
| `POST /auth/login` | Public | Body `{ "email", "password" }`; sets the session cookie; returns `{ "id", "name", "role" }` | Mon 30 Nov |
| `POST /auth/logout` | Staff | Clears the session | Mon 30 Nov |
| `GET /auth/me` | Staff | Who is logged in | Mon 30 Nov |
| `GET, POST /admin/rooms`; `GET, PATCH /admin/rooms/:id` | Staff | List, add, edit, hide room types (includes hidden ones) | Thu 3 Dec |
| `GET, POST /admin/amenities`; `PATCH, DELETE /admin/amenities/:id` | Staff | Manage amenities | Thu 3 Dec |
| `POST /admin/uploads` | Staff | Multipart photo upload; returns `{ "url" }` | Thu 3 Dec |
| `GET, POST /admin/menu/categories`; `PATCH, DELETE /admin/menu/categories/:id` | Staff | Manage categories | Mon 7 Dec |
| `GET, POST /admin/menu/items`; `PATCH, DELETE /admin/menu/items/:id` | Staff | Manage items | Mon 7 Dec |
| `GET /admin/bookings/rooms?status=pending&from=&to=` | Staff | List room bookings | Mon 7 Dec |
| `PATCH /admin/bookings/rooms/:id` | Staff | Body `{ "action": "confirm" \| "decline" }`; emails the guest | Mon 7 Dec |
| `GET /admin/bookings/tables?status=&date=` | Staff | List table bookings | Mon 7 Dec |
| `PATCH /admin/bookings/tables/:id` | Staff | Confirm or decline | Mon 7 Dec |
| `GET, POST /admin/blocked-dates`; `DELETE /admin/blocked-dates/:id` | Staff | Block rooms for maintenance or walk-ins | Mon 7 Dec |
| `PUT /admin/content/:key` | Staff | Edit page text | Mon 7 Dec |
| `GET, PUT /admin/restaurant-settings` | Manager | Opening times, slot length, seats per slot | Mon 7 Dec |
| `GET, POST /admin/users`; `DELETE /admin/users/:id` | Manager | Staff logins | Mon 7 Dec |
