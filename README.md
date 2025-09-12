# Space Marine 2 Talent Calculator

A web-based build planner for *Warhammer 40,000: Space Marine 2* that allows players to create, customize, and share talent builds via URL.

## Features

- **6 Classes**: Assault, Bulwark, Tactical, Devastator, Sniper, and Vanguard
- **Perk Trees**: Core and Team sections with column-based selection (one perk per column)
- **Prestige Perks**: Select up to 4 out of 8 prestige perks per class
- **URL Sharing**: Builds are encoded in the URL for easy sharing (no database required)
- **Responsive Design**: Works on desktop and mobile devices
- **Space Marine Theme**: Dark UI with gold/blue highlights inspired by the game

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PM2 (for production deployment)

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Deployment with PM2

1. Install PM2 globally (if not already installed):
   ```bash
   npm install -g pm2
   ```

2. Start the application:
   ```bash
   npm run pm2:start
   ```

3. Other PM2 commands:
   ```bash
   npm run pm2:stop     # Stop the application
   npm run pm2:restart  # Restart the application
   npm run pm2:delete   # Delete the application from PM2
   npm run pm2:logs     # View application logs
   ```

## Usage

1. **Select a Class**: Click on any of the 6 class tabs at the top
2. **Choose Perks**: 
   - Click perk tiles in the Core and Team sections
   - Only one perk per column can be selected
   - Click again to deselect
3. **Select Prestige Perks**:
   - Choose up to 4 out of 8 prestige perks
   - Tiles become disabled when limit is reached
4. **Share Your Build**:
   - Click "Share Build" to get a shareable URL
   - The URL contains your entire build configuration
5. **Reset Options**:
   - "Reset Class" clears selections for current class only
   - "Reset All" clears everything

## URL Format

Builds are encoded using this format:
```
?b={version}.{classId}.{payload}
```

- **version**: Format version (currently 1)
- **classId**: Class identifier (assault, bulwark, tactical, etc.)
- **payload**: Base64URL-encoded binary data containing perk selections

## Data Structure

The talent data is stored in `data.json` following this schema:

```json
{
  "classes": [
    {
      "id": "class-id",
      "name": "Class Name",
      "sections": [
        {
          "id": "core|team",
          "name": "Section Name",
          "columns": [
            {
              "id": "column-id",
              "name": "Column Name",
              "perks": [
                {
                  "id": "perk-id",
                  "name": "Perk Name",
                  "desc": "Perk description",
                  "img": "perk-image.png"
                }
              ]
            }
          ]
        }
      ],
      "prestige": [
        {
          "id": "prestige-perk-id",
          "name": "Prestige Perk Name",
          "desc": "Prestige perk description",
          "img": "prestige-perk-image.png"
        }
      ]
    }
  ]
}
```

## Customization

### Adding New Classes or Perks

1. Edit `data.json` to add new classes, sections, columns, or perks
2. Ensure all IDs are unique and stable (don't change once published)
3. Add corresponding image files to an `images/` directory (optional)

### Styling

- Main styles are in `styles.css`
- Uses CSS custom properties for easy theme customization
- Responsive design with mobile-first approach

### Images

Currently, the application uses text placeholders for perk icons. To add actual images:

1. Create an `images/` directory
2. Add perk images matching the filenames in `data.json`
3. Update the JavaScript to load actual images instead of text placeholders

## Browser Support

- Modern browsers with ES6+ support
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## License

MIT License - see LICENSE file for details 