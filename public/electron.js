const path = require('path');

const {
    functions
} = require('../src/shared/constants');

const {
    app,
    ipcMain,
    BrowserWindow,
    desktopCapturer, 
    screen, 
    dialog, 
    clipboard, 
    nativeImage, 
    globalShortcut, 
    Tray, 
    Menu
} = require('electron');

const AutoLaunch = require('auto-launch');

const fs = require('fs');

var screen_list = [];

var test = false;
var devTools = true;

var screen_ids = {};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getScreenIds() {
    let tmp = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { width: 0, height: 0 }
    });

    screen_ids = {};
    for (let i = 0; i < tmp.length; ++i) {
        screen_ids[tmp[i].display_id] = tmp[i].id;
    }
}

async function createWindow() {
    while (screen_ids == {}) {
        await sleep(100);
    }

    let screens = screen.getAllDisplays();

    for (let i = 0; i < screens.length; ++i) {
        const win = new BrowserWindow({
            width: screens[i].size.width,
            height: screens[i].size.height,
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
            show: false,
            // fullscreen: true,
        });

        win.loadURL(
            !app.isPackaged ?
            'http://localhost:3000?screen=' + String(screens[i].id) + '&i=' + i + '&capture_id=' + screen_ids[String(screens[i].id)] :
            `file://${path.join(__dirname, '../build/index.html')}?screen=${String(screens[i].id)}&i=${i}&capture_id=${screen_ids[String(screens[i].id)]}`
        );

        if (!app.isPackaged && !(test && i == 0)) {
            if (devTools) {
                win.webContents.openDevTools({
                    mode: 'detach'
                });
            }
        }

        screen_list.push({
            win: win,
            screen: screens[i],
            capture_id: screen_ids[String(screens[i].id)],
            id: screens[i].id,
            i: i,
        })
    }
}
  
function registerPrintScreen() {
    // const ret = globalShortcut.register('printscreen', () => {
    const ret = globalShortcut.register('PrintScreen', () => {
        console.log('PrintScreen');
        createWindow()
    })

    console.log('registerPrintScreen: ', ret);

    if (!ret) {
        console.log('registration failed')
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

let tray = null
app.whenReady().then(() => {
    console.log('isPackaged: ', app.isPackaged);
    if (app.isPackaged) {
        console.log(app.getPath('exe'));
        let autoLaunch = new AutoLaunch({
            name: 'Texugo PrintScreen',
            path: app.getPath('exe'),
        });
        autoLaunch.isEnabled().then((isEnabled) => {
            autoLaunch.enable();
        });
    }

    const assetsPath = app.isPackaged ? path.join(process.resourcesPath, "assets") : "assets";

    tray = new Tray(path.join(assetsPath, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Quit', type: 'normal', click: () => { app.quit(); } }
    ])
    tray.setToolTip('Texugo ScreenShot')
    tray.setContextMenu(contextMenu)

    registerPrintScreen();

    getScreenIds();

    setInterval(() => {
        getScreenIds();
    }, 1000 * 10);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    /*if (process.platform !== 'darwin') {
        app.quit();
    }*/
});

app.on('will-quit', () => {
    // Unregister all shortcuts.
    //globalShortcut.unregisterAll();
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on(functions.SHOW, async(event, arg) => {
    let i = parseInt(arg);

    let screen = screen_list[i];

    if (screen == null) return;

    if (test && i === 0) {
        return;
    }

    screen.win.show();
    screen.win.setPosition(screen.screen.bounds.x, screen.screen.bounds.y);
    screen.win.setFullScreen(true);

    if (i === 0) {
        screen.win.focus(); 
        setTimeout(() => {
            screen.win.focus();   
        }, 500);
    }
});


function close(){
    for (let i = 0; i < screen_list.length; ++i) {
        screen_list[i].win.close();
    }
    screen_list = [];
    //registerPrintScreen();
}

ipcMain.on(functions.CLOSE, async(event, arg) => {
    close();
});

function fillString(str, len) {
    str = str.toString();

    while (str.length < len) {
        str = '0' + str;
    }

    return str;
}

ipcMain.on(functions.SAVE, async(event, arg) => {
    let date = new Date();

    let filename = date.getFullYear() + '-' + fillString(date.getMonth() + 1, 2) + '-' + fillString(date.getDate(), 2) + '_' +
        fillString(date.getHours(), 2) + '-' + fillString(date.getMinutes(), 2) + '-' + fillString(date.getSeconds(), 2);

    filename = 'screenshot ' + filename + '.png';

    //save file dialog
    dialog.showSaveDialog({
        title: 'Save screenshot',
        defaultPath: filename,
        buttonLabel: 'Save',
        // filters: [{
        //     name: 'Images',
        //     extensions: ['png']
        // }]
    }).then(file => {
        if (file.canceled) {
            return;
        }

        var base64Data = arg.replace(/^data:image\/png;base64,/, "");

        let filePath = file.filePath.toString();
        if (!filePath.endsWith('.png')) {
            filePath += '.png';
        }

        //write file
        fs.writeFile(filePath, base64Data, 'base64', (err) => {
            if (err) {
                console.log(err);
            }
            close();
        });
    });
});

ipcMain.on(functions.COPY, async(event, arg) => {
    //var base64Data = arg.replace(/^data:image\/png;base64,/, "");

    //copy to clipboard
    clipboard.writeImage(nativeImage.createFromDataURL(arg));

    close();
});