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


async function createWindow() {
    let screens = screen.getAllDisplays();

    let aspect_list = [];
    for (let i = 0; i < screens.length; ++i) {
        const aspect = screens[i].size.width / screens[i].size.height;
        const size = screens[i].size.width * screens[i].size.height;
        
        let found = false;
        for (let j = 0; j < aspect_list.length; ++j) {
            if (aspect_list[j].aspect === aspect) {
                aspect_list[j].screens.push(screens[i].id);
                
                if (size > aspect_list[j].biggest){
                    aspect_list[j].biggest = size;
                    aspect_list[j].width = screens[i].size.width;
                    aspect_list[j].height = screens[i].size.height;
                }

                found = true;
                break;
            }
        }

        if (!found) {
            aspect_list.push({
                aspect: aspect,
                screens: [screens[i].id],
                biggest: size,
                width: screens[i].size.width,
                height: screens[i].size.height,
            });
        }
    }

    console.time('capture');
    let captures = {};
    for (let i = 0; i < aspect_list.length; ++i) {
        console.time('getSources');
        let tmp = await desktopCapturer.getSources({ 
            types: ['screen'], 
            thumbnailSize: { width: aspect_list[i].width, height: aspect_list[i].height }
        });
        console.timeEnd('getSources');

        for (let j = 0; j < tmp.length; ++j) {
            for (let k = 0; k < aspect_list[i].screens.length; ++k) {
                if (tmp[j].display_id == aspect_list[i].screens[k]) {
                    captures[String(aspect_list[i].screens[k])] = tmp[j].thumbnail.toDataURL();
                    break;
                }
            }
        }
    }
    console.timeEnd('capture');

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
            'http://localhost:3000?screen=' + String(screens[i].id + '&i=' + i) :
            `file://${path.join(__dirname, '../build/index.html')}?screen=${String(screens[i].id)}&i=${i}`
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
            base64: captures[String(screens[i].id)],
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

ipcMain.on(functions.GET_IMAGE, async(event, arg) => {
    let screen = null;
    for (let i = 0; i < screen_list.length; ++i) {
        if (screen_list[i] == null) continue;
        if (screen_list[i].screen == null) continue;

        if (screen_list[i].id == arg) {
            screen = screen_list[i];
            screen.i = i;
            break;
        }
    }

    if (screen == null) return;

    screen.win.webContents.send(functions.GET_IMAGE, JSON.stringify({
        id: screen.id,
        i: screen.i,
        base64: screen.base64,
        width: screen.screen.size.width,
        height: screen.screen.size.height,
    }));
});

ipcMain.on(functions.SHOW, async(event, arg) => {
    let i = arg;

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