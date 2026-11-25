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

`key` is `home`, `about`, `rooms`, `restaurant`, `events` or `contact`. `body` is every section's text joined with a blank line.

```json
{ "key": "about", "title": "About us", "body": "…", "updatedAt": "2026-11-24T10:18:39.790Z" }
```

### `POST /contact` (Planned, Mon 30 Nov)

Request: `{ "name": "…", "email": "…", "phone": "…", "message": "…" }`. Response `202`: `{ "sent": true }`.

## Public website endpoints (Live, branch `c/admin-api`)

Same data as above, in the shapes the public website uses (`epikaizo-frontend/src/lib/types.ts`). Sent with `Cache-Control: no-store` so dashboard edits show on the next page load.

| Path | Returns |
| --- | --- |
| `GET /public/rooms` | Active rooms with `totalUnits`, `sortOrder`, photos (with `sortOrder`) and active `setups` (`{ id, roomTypeId, name, maxGuests, pricePerNight, isActive, sortOrder, onRequestOnly }`) |
| `GET /public/rooms/:slug` | One active room, same shape; 404 if hidden or unknown |
| `GET /public/menu` | Categories with `sortOrder`; items with `categoryId`, `sortOrder`, `sideOptions` |
| `GET /public/content/:key` | `{ key, title, body, subtitle, sections, updatedAt }` |
| `GET /public/settings` | Contact details, check-in/out, restaurant hours, food-order times (built from the dashboard settings; three fields are placeholders) |

## Admin endpoints

All need a logged-in session: `POST /auth/login` sets an httpOnly cookie (`epk_session`, 7 days, SameSite=Lax, Secure in production). The dashboard calls the API through its own `/api` rewrite, so the cookie is first-party. Send requests with `credentials: "include"`. Shapes follow `web/types/api.ts` (Docking Spec v1.1). Errors use the shape above; 401 `not_logged_in`, 403 `forbidden`, 409 `conflict` / `not_empty` / `invalid_state`.

### Live (branch `c/admin-api`)

| Method and path | Role | Notes |
| --- | --- | --- |
| `POST /auth/login` | Public | Body `{ "username", "password" }` (`email` also accepted). Returns `{ "user": { id, name, username, role } }`. 401 `invalid_credentials` |
| `POST /auth/logout` | Any | 204, clears the cookie and deletes the session |
| `GET /auth/me` | Staff | `{ "user": ... }` |
| `/admin/login`, `/admin/logout`, `/admin/me` | | Aliases of the three above |
| `GET /admin/summary` | Staff | Counts for the dashboard home (orders are 0 until orders exist) |
| `GET, POST /admin/rooms`; `GET, PATCH /admin/rooms/:id` | Staff | Includes hidden rooms. Body `{ name, description, totalUnits, amenityIds, isActive?, sortOrder? }`. Slug is made from the name on create and kept on rename |
| `POST /admin/rooms/:id/setups`; `PATCH /admin/setups/:id` | Staff | `{ name, maxGuests, pricePerNight, onRequest, isActive?, sortOrder? }`. Updates `room_types.price_per_night` (cheapest active setup) and `max_guests` (largest) |
| `GET, POST /admin/amenities` | Staff | |
| `POST /admin/uploads` | Staff | Multipart, field `file`. JPEG, PNG or WebP, max 5 MB (checked by content). Saved in `api/uploads/` (gitignored), served at `GET /uploads/<name>`. Returns `{ url, width, height }`; `url` uses `PUBLIC_API_URL` (default `http://localhost:4000`) |
| `GET /admin/photos?gallery=true`; `POST /admin/photos`; `PATCH, DELETE /admin/photos/:id`; `PUT /admin/photos/order` | Staff | Attach by URL: `{ url, alt, roomTypeId | menuItemId | isGallery }` |
| `GET, POST /admin/menu/categories`; `PATCH, DELETE /admin/menu/categories/:id` | Staff | Delete refuses (409 `not_empty`) while dishes remain |
| `GET /admin/menu/items?categoryId=`; `POST /admin/menu/items`; `PATCH, DELETE /admin/menu/items/:id` | Staff | Includes `sideOptions` |
| `GET /admin/content`; `PUT /admin/content/:key` | Staff | Body `{ title, subtitle, sections: [{ heading, body }] }`; also updates the plain `body` column |
| `GET /admin/settings` / `PUT /admin/settings` | Staff / Manager | Whole `SiteSettings` object. PUT also updates `restaurant_settings` |
| `GET, POST /admin/users`; `PATCH, DELETE /admin/users/:id` | Manager | Can't delete yourself or the last manager |
| `GET /admin/bookings/rooms`, `GET, PATCH /admin/bookings/rooms/:id` | Staff | List with filters; PATCH `{ action: confirm | decline | cancel }`. No guest email yet; `setup` is a placeholder until bookings store a setup |
| `GET /admin/bookings/tables`, `PATCH /admin/bookings/tables/:id` | Staff | Same |
| `GET, POST /admin/blocked-dates`; `DELETE /admin/blocked-dates/:id` | Staff | |
| `GET /admin/orders` | Staff | Always an empty list for now |

### Still to build

- Cloud storage for photos before deploying to a host that wipes its disk.
- Food orders (table, public `POST`, admin `PATCH /admin/orders/:id`).
- Guest emails when a booking is decided; login rate limiting.

### Original plan (for reference)


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
