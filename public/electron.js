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

var win_list = [];

var test = false;
var devTools = true;

function createWindow() {
    desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { width: 0, height: 0 }
    }).then( sources => {
        for (let i = 0; i < sources.length; ++i) {
            const win = new BrowserWindow({
                width: 800,
                height: 600,
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
                'http://localhost:3000?screen=' + sources[i].id + '&i=' + i :
                `file://${path.join(__dirname, '../build/index.html')}?screen=${sources[i].id}&i=${i}`
            );

            if (!app.isPackaged && !(test && i == 0)) {
                if (devTools) {
                    win.webContents.openDevTools({
                        mode: 'detach'
                    });
                }
            }

            win_list.push(win);
        }
    })
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
            //console.log('isEnabled: ', isEnabled);
            //if (!isEnabled) autoLaunch.enable();
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
    //globalShortcut.unregisterAll()
    //console.log('will-quit');
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on(functions.GET_IMAGE, async(event, arg) => {
    //event.reply(functions.GET_IMAGE, images[arg]);
});

ipcMain.on(functions.SHOW, async(event, arg) => {
    if (win_list[arg] == null) return;

    if (test && arg === "0") {
        return;
    }

    const displays = screen.getAllDisplays()
    const display = displays[arg]

    win_list[arg].show();
    win_list[arg].setPosition(display.bounds.x, display.bounds.y);
    win_list[arg].setFullScreen(true);
    win_list[arg].focus();
});

function close(){
    for (let i = 0; i < win_list.length; ++i) {
        win_list[i].close();
    }
    win_list = [];
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