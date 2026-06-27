# Firmware Guide

Firmware lives in `firmware/` and is a PlatformIO project.

## Commands

```powershell
npm run firmware:build
npm run firmware:upload
npm run firmware:monitor
```

The current firmware config uses:

- platform: `espressif32`
- board: `upesy_wroom`
- framework: `arduino`
- upload/monitor port: `COM13`

Update `firmware/platformio.ini` when testing on another machine or serial port.
