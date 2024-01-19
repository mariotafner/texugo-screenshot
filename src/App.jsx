import './App.css';
import { functions } from './shared/constants';
import { useEffect, useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowPointer, faArrowRotateLeft, faClose, faCopy, faExpand, faFloppyDisk, faGripVertical, faLeftLong, faTrash, faSquare as faSquareFill, faVectorSquare, faFont, faCheck } from '@fortawesome/free-solid-svg-icons'
import { faSquare } from '@fortawesome/free-regular-svg-icons'
import Tooltip from "./Tooltip";

const {ipcRenderer} = window.require('electron');

function App() {
    const [image, setImage] = useState(null);
    const [tool, setTool] = useState(null);
    const [history, setHistory] = useState([]);
    const [color, setColor] = useState("#ff0000");
    const [text, setText] = useState("");
    
    const toolbar = useRef(null);
    const toolbarDrag = useRef(null);
    const selectBox = useRef(null);
    const canvasForeground = useRef(null);
    const rect = useRef(null);
    const borderRect = useRef(null);
    const canvas = useRef(null);
    const rectangle = useRef(null);
    const line = useRef(null);
    const cursor = useRef(null);
    const textbox = useRef(null);
    const textboxContainer = useRef(null);

    const resizeTextArea = () => {
        textbox.current.style.height = "auto";
        textbox.current.style.height = textbox.current.scrollHeight + "px";
        textbox.current.style.width = textbox.current.scrollWidth + "px";
    };
    
      useEffect(resizeTextArea, [text]);
    
    const onChange = e => {
        setText(e.target.value);
    };

    function cancelTextbox() {
        textboxContainer.current.style.display = "none";
        setText("");
    }

    function createTextbox(e) {
        if (e.target === textbox.current) return;
        if (tool !== "text") return;

        setText("");

        let x = e.clientX;
        let y = e.clientY;

        y -= 10;

        if (y < 0) {
            y = 0;
        }

        textboxContainer.current.style.top = y + "px";
        textboxContainer.current.style.left = x + "px";
        textboxContainer.current.style.display = "flex";
        textbox.current.focus();
    }

    function applyText() {
        let color = document.getElementById("color").value;
        let previouseData = canvas.current.toDataURL('image/png');

        addHistory({
            type: "canvas",
            data: previouseData,
        });

        let ctx = canvas.current.getContext('2d');
        ctx.fillStyle = color;

        let textbox_rect = textbox.current.getBoundingClientRect();

        let left = textbox_rect.left;
        let top = textbox_rect.top;

        left = left + 0;
        top = top + 20;

        ctx.font = "15pt Arial";

        function fillTextMultiLine(ctx, text, x, y) {
            let lineHeight = ctx.measureText("M").width * 1.2;
            lineHeight += 2; 
            let lines = text.split("\n");
            for (let i = 0; i < lines.length; ++i) {
                ctx.fillText(lines[i], x, y);
                y += lineHeight;
            }
        }

        fillTextMultiLine(ctx, text, left, top);

        textboxContainer.current.style.display = "none";
        setText("");
    }

    async function addHistory(action) {
        let tmp = history;
        tmp.push(action);

        if (tmp.length > 5) {
            tmp.shift();
        }

        setHistory(tmp);
    }

    async function undo() {
        if (history.length === 0) return;

        let tmp = history;
        let action = tmp.pop();

        if (action.type === "canvas") { 
            setImage(action.data);
            let ctx = canvas.current.getContext('2d');
            
            let img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            }
            img.src = action.data;
        }
        else if (action.type === "selection") {
            let xInput = document.getElementById("x");
            let yInput = document.getElementById("y");
            let wInput = document.getElementById("w");
            let hInput = document.getElementById("h");

            xInput.value = action.data.x;
            yInput.value = action.data.y;
            wInput.value = action.data.w;
            hInput.value = action.data.h;

            let left = parseInt(action.data.x);
            let top = parseInt(action.data.y);
            let width = parseInt(action.data.w);
            let height = parseInt(action.data.h);

            left = left - 5;
            top = top - 5;
            width = width + 15;
            height = height + 15;

            selectBox.current.style.left = left + "px";
            selectBox.current.style.top = top + "px";
            selectBox.current.style.width = width + "px";
            selectBox.current.style.height = height + "px";

            applyRect();

            width = width - 20;
            height = height - 20;
            left = left + 5;
            top = top + 5;

            borderRect.current.style.width = width + 'px';
            borderRect.current.style.height = height + 'px';
            borderRect.current.style.top = top + 'px';
            borderRect.current.style.left = left + 'px';
        }

        setHistory(tmp);
    }

    async function screenshot(screenID) {
        return await new Promise((resolve, reject) => {
            let settings = {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: screenID,
                },
            }
    
            navigator.mediaDevices.getUserMedia({
                video: settings,
            }).then((stream) => {
                let video = document.createElement('video');
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    video.play();
                    
                    canvas.current.width = video.videoWidth;
                    canvas.current.height = video.videoHeight;
                    canvas.current.getContext('2d').drawImage(video, 0, 0, canvas.current.width, canvas.current.height);
                    let data = canvas.current.toDataURL('image/png');
                    resolve(data);
                }
            }).catch((e) => {
                console.error(e);
                reject(e);
            })
        });
    }

    async function takeScreenshot(screenID) {
        let data = await screenshot(screenID);
        setImage(data);
    }

    async function start() {
        let current_url = window.location.href;
        let url = new URL(current_url);
        let screen = url.searchParams.get("screen");
        let i = url.searchParams.get("i");

        await takeScreenshot(screen);

        setTimeout(() => {
            ipcRenderer.send(functions.SHOW, i);

            setTimeout(() => {
                if (toolbar.current) {
                    toolbar.current.style.display = "flex";
                    toolbar.current.style.top = (window.innerHeight - 120) + "px";
                    toolbar.current.style.left = (window.innerWidth / 2) - (toolbar.current.offsetWidth / 2) + "px";
                    
                    document.addEventListener('keydown', (e) => {
                        if (textbox.current === document.activeElement) {
                            if (e.key === "Escape") {
                                cancelTextbox();
                            }
                        }
                        else {
                            if (e.key === "Escape") {
                                ipcRenderer.send(functions.CLOSE);
                            }
                            
                            if (e.ctrlKey && e.key === "c") {
                                copy();
                            }
    
                            if (e.key === "Delete") {
                                clear_selection();
                            }
    
                            if (e.ctrlKey && e.key === "a") {
                                expand_selection();
                            }
                            e.preventDefault();
                        }

                        if (e.ctrlKey && e.key === "z") {
                            undo();
                        }
                        if (e.ctrlKey && e.key === "s") {
                            save();
                        }
                    });
                }
            }, 500);
        }, 10);
    }

    useEffect(() => {
        start();

        window.addEventListener("mousedown", (e) => {
            const tempTool = document.getElementById("tool").value;
            const relative_mouse_x = e.clientX - toolbar.current.offsetLeft;
            const relative_mouse_y = e.clientY - toolbar.current.offsetTop;
    
            if (toolbar.current && toolbarDrag.current.contains(e.target)){
                toolbar.current.setAttribute("data-dragging", true)
                toolbarDrag.current.style.cursor = "grabbing";
                // setMouseDragPosition({ x: relative_mouse_x, y: relative_mouse_y });

                toolbar.current.setAttribute("mouse-start-drag-position-x", relative_mouse_x);
                toolbar.current.setAttribute("mouse-start-drag-position-y", relative_mouse_y);
            }
    
            if (canvasForeground.current && canvasForeground.current.contains(e.target) && tempTool === ''){
                canvasForeground.current.setAttribute("data-dragging", true)
                selectBox.current.style.left = e.clientX + "px";
                selectBox.current.style.top = e.clientY + "px";
                selectBox.current.style.height = "0px";
                selectBox.current.style.width = "0px";
                selectBox.current.style.display = "none";
    
                selectBox.current.setAttribute("mouse-start-resize-position-x", e.clientX);
                selectBox.current.setAttribute("mouse-start-resize-position-y", e.clientY);
            }
    
            if (selectBox.current && selectBox.current.contains(e.target) && e.target.getAttribute("resize") && tempTool === '') {
                let left = parseInt(selectBox.current.style.left.replace("px", ""));
                let top = parseInt(selectBox.current.style.top.replace("px", ""));
                let width = parseInt(selectBox.current.style.width.replace("px", ""));
                let height = parseInt(selectBox.current.style.height.replace("px", ""));        
    
                selectBox.current.style.left = left + "px";
                selectBox.current.style.top = top + "px";
                selectBox.current.style.width = width + "px";
                selectBox.current.style.height = height + "px";
    
                selectBox.current.setAttribute("data-resizing", e.target.getAttribute("resize"))
                selectBox.current.setAttribute("mouse-start-resize-position-x", e.clientX)
                selectBox.current.setAttribute("mouse-start-resize-position-y", e.clientY)
    
                selectBox.current.setAttribute("initial-modal-height", height);
                selectBox.current.setAttribute("initial-modal-width", width);
    
                selectBox.current.setAttribute("initial-modal-left", left);
                selectBox.current.setAttribute("initial-modal-top", top);
            }     
            
            if (canvasForeground.current && tempTool === "rectangle" && !toolbar.current.contains(e.target)) {
                rectangle.current.style.display = "block";
                rectangle.current.style.left = e.clientX + "px";
                rectangle.current.style.top = e.clientY + "px";
                rectangle.current.style.height = "0px";
                rectangle.current.style.width = "0px";
    
                rectangle.current.setAttribute("mouse-start-resize-position-x", e.clientX);
                rectangle.current.setAttribute("mouse-start-resize-position-y", e.clientY);
                rectangle.current.setAttribute("data-dragging", true);
            }

            if (canvasForeground.current && tempTool === "arrow" && !toolbar.current.contains(e.target)) {
                line.current.style.display = "block";
                line.current.setAttribute("x1", e.clientX);
                line.current.setAttribute("y1", e.clientY);
                line.current.setAttribute("x2", e.clientX);
                line.current.setAttribute("y2", e.clientY);
                line.current.setAttribute("data-dragging", true);
            }
        });
    
        window.addEventListener("mouseup", (e) => {
            const tempTool = document.getElementById("tool").value;
            if (toolbar.current){
                toolbarDrag.current.style.cursor = "grab";
                toolbar.current.setAttribute("data-dragging", false)
            }
    
            if (selectBox.current){
                selectBox.current.style.display = "flex";
    
                if (canvasForeground.current.getAttribute("data-dragging") === "true" || selectBox.current.getAttribute("data-resizing")) {
                    let left = parseInt(selectBox.current.style.left.replace("px", ""));
                    let top = parseInt(selectBox.current.style.top.replace("px", ""));
                    let width = parseInt(selectBox.current.style.width.replace("px", ""));
                    let height = parseInt(selectBox.current.style.height.replace("px", ""));
    
                    selectBox.current.style.left = left + "px";
                    selectBox.current.style.top = top + "px";
                    selectBox.current.style.width = width + "px";
                    selectBox.current.style.height = height + "px";
    
                    selectBox.current.removeAttribute("data-resizing");

                    let xInput = document.getElementById("x");
                    let yInput = document.getElementById("y");
                    let wInput = document.getElementById("w");
                    let hInput = document.getElementById("h");

                    if (xInput.value !== ''){
                        addHistory({
                            type: "selection",
                            data: {
                                x: parseInt(xInput.value),
                                y: parseInt(yInput.value),
                                w: parseInt(wInput.value),
                                h: parseInt(hInput.value),
                            },
                        });
                    }
                    else {
                        addHistory({
                            type: "selection",
                            data: {
                                x: 0,
                                y: 0,
                                w: 0,
                                h: 0,
                            },
                        });
                    }

                    xInput.value = left;
                    yInput.value = top;
                    wInput.value = width;
                    hInput.value = height;
                }
    
                canvasForeground.current.setAttribute("data-dragging", false)
            }
    
            rectangle.current.style.display = "none";
            line.current.style.display = "none";
    
            if (tempTool === "rectangle" && rectangle.current.getAttribute("data-dragging") === "true") {
                let color = document.getElementById("color").value;
                let previouseData = canvas.current.toDataURL('image/png');
      
                addHistory({
                    type: "canvas",
                    data: previouseData,
                });
    
                let ctx = canvas.current.getContext('2d');
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
    
                let left = parseInt(rectangle.current.style.left.replace("px", ""));
                let top = parseInt(rectangle.current.style.top.replace("px", ""));
                let width = parseInt(rectangle.current.style.width.replace("px", ""));
                let height = parseInt(rectangle.current.style.height.replace("px", ""));
    
                left = left + 2;
                top = top + 2;
    
                ctx.strokeRect(left, top, width, height);

                rectangle.current.setAttribute("data-dragging", false);
            }

            if (tempTool === "arrow" && line.current.getAttribute("data-dragging") === "true") {
                let color = document.getElementById("color").value;
                let previouseData = canvas.current.toDataURL('image/png');
                
                addHistory({
                    type: "canvas",
                    data: previouseData,
                });
    
                let x1 = parseInt(line.current.getAttribute("x1"));
                let y1 = parseInt(line.current.getAttribute("y1"));
                let x2 = parseInt(line.current.getAttribute("x2"));
                let y2 = parseInt(line.current.getAttribute("y2"));
    
                var headlen = 10;
                var angle = Math.atan2(y2-y1,x2-x1);

                let ctx = canvas.current.getContext('2d');
                ctx.strokeStyle = color;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2-headlen*Math.cos(angle-Math.PI/7),
                           y2-headlen*Math.sin(angle-Math.PI/7));

                ctx.lineTo(x2-headlen*Math.cos(angle+Math.PI/7),
                           y2-headlen*Math.sin(angle+Math.PI/7));

                ctx.lineTo(x2, y2);
                ctx.lineTo(x2-headlen*Math.cos(angle-Math.PI/7),
                           y2-headlen*Math.sin(angle-Math.PI/7));

                ctx.stroke();
                ctx.restore();

                line.current.setAttribute("data-dragging", false);
            }
        }) 
    
        window.addEventListener("mousemove", (e) => {
            const tempTool = document.getElementById("tool").value;
            const mouseY = e.clientY;
            const mouseX = e.clientX;
    
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            // if (cursor.current) {
            //     cursor.current.style.top = (mouseY + 15) + "px";
            //     cursor.current.style.left = (mouseX + 15) + "px";
            // }
    
            if (toolbar.current && toolbar.current.getAttribute("data-dragging") === "true" && tempTool === '') {
                const newTop = mouseY - toolbar.current.getAttribute("mouse-start-drag-position-y");
                const newLeft = mouseX - toolbar.current.getAttribute("mouse-start-drag-position-x");
    
                const toolbarHeight = toolbar.current.offsetHeight;
                const toolbarWidth = toolbar.current.offsetWidth;
    
                if (newTop > 0 && newTop + toolbarHeight < windowHeight) {
                    toolbar.current.style.top = newTop + "px";
                }
    
                if (newLeft > 0 && newLeft + toolbarWidth < windowWidth) {
                    toolbar.current.style.left = newLeft + "px";
                }
            }
    
            if (canvasForeground.current && canvasForeground.current.getAttribute("data-dragging") === "true" && tempTool === '') {
                let selectBoxTop = parseInt(selectBox.current.getAttribute("mouse-start-resize-position-y"));
                let selectBoxLeft = parseInt(selectBox.current.getAttribute("mouse-start-resize-position-x"));
    
                let newHeight = mouseY - selectBoxTop;
                let newWidth = mouseX - selectBoxLeft;
    
                let newTop = selectBoxTop;
                let newLeft = selectBoxLeft;
    
                if (newHeight < 0) {
                    newTop = mouseY;
                    newHeight = Math.abs(newHeight);
                }
    
                if (newWidth < 0) {
                    newLeft = mouseX;
                    newWidth = Math.abs(newWidth);
                }
    
                newHeight = newHeight + 15;
                newWidth = newWidth + 15;
    
                newTop = newTop - 5;
                newLeft = newLeft - 5;
    
                selectBox.current.style.height = newHeight + "px";
                selectBox.current.style.width = newWidth + "px";
                selectBox.current.style.top = newTop + "px";
                selectBox.current.style.left = newLeft + "px";
                
                applyRect();
            }
    
            if (selectBox.current && selectBox.current.getAttribute("data-resizing") && tempTool === '') {
                const boxHeight = selectBox.current.getAttribute("initial-modal-height");
                const boxWidth = selectBox.current.getAttribute("initial-modal-width");
    
                const resize = selectBox.current.getAttribute("data-resizing");
    
                if (resize === "bottom") {                
                    let mouseZeroY = mouseY - selectBox.current.getAttribute("mouse-start-resize-position-y");
                    const newHeight = parseInt(boxHeight) + parseInt(mouseZeroY);
                    selectBox.current.style.height = newHeight + "px";
                }
    
                if (resize === "right") {
                    let mouseZeroX = mouseX - selectBox.current.getAttribute("mouse-start-resize-position-x");
                    const newWidth = parseInt(boxWidth) + parseInt(mouseZeroX);
                    selectBox.current.style.width = newWidth + "px";
                }
    
                if (resize === "left") {
                    let mouseZeroX = mouseX - selectBox.current.getAttribute("mouse-start-resize-position-x");
                    const newWidth = parseInt(boxWidth) - parseInt(mouseZeroX);
                    selectBox.current.style.width = newWidth + "px";
    
                    let modalLeft = parseInt(selectBox.current.getAttribute("initial-modal-left"));
                    
                    selectBox.current.style.left = modalLeft + parseInt(mouseZeroX) + "px";
                }
    
                if (resize === "bottom-left") {
                    let mouseZeroX = mouseX - selectBox.current.getAttribute("mouse-start-resize-position-x");
                    let mouseZeroY = mouseY - selectBox.current.getAttribute("mouse-start-resize-position-y");
    
                    const newWidth = parseInt(boxWidth) - parseInt(mouseZeroX);
                    const newHeight = parseInt(boxHeight) + parseInt(mouseZeroY);
    
                    selectBox.current.style.width = newWidth + "px";
                    selectBox.current.style.height = newHeight + "px";
    
                    let modalLeft = parseInt(selectBox.current.getAttribute("initial-modal-left"));
                    
                    selectBox.current.style.left = modalLeft + parseInt(mouseZeroX) + "px";
                }
    
                if (resize === "bottom-right") {
                    let mouseZeroX = mouseX - selectBox.current.getAttribute("mouse-start-resize-position-x");
                    let mouseZeroY = mouseY - selectBox.current.getAttribute("mouse-start-resize-position-y");
    
                    const newWidth = parseInt(boxWidth) + parseInt(mouseZeroX);
                    const newHeight = parseInt(boxHeight) + parseInt(mouseZeroY);
    
                    selectBox.current.style.width = newWidth + "px";
                    selectBox.current.style.height = newHeight + "px";
                }
    
                if (resize === "top") {
                    let mouseZeroY = mouseY - selectBox.current.getAttribute("mouse-start-resize-position-y");
                    const newHeight = parseInt(boxHeight) - parseInt(mouseZeroY);
                    selectBox.current.style.height = newHeight + "px";
    
                    let modalTop = parseInt(selectBox.current.getAttribute("initial-modal-top"));
                    
                    selectBox.current.style.top = modalTop + parseInt(mouseZeroY) + "px";
                }
    
                if (resize === "top-left") {
                    let mouseZeroX = mouseX - selectBox.current.getAttribute("mouse-start-resize-position-x");
                    let mouseZeroY = mouseY - selectBox.current.getAttribute("mouse-start-resize-position-y");
    
                    const newWidth = parseInt(boxWidth) - parseInt(mouseZeroX);
                    const newHeight = parseInt(boxHeight) - parseInt(mouseZeroY);
    
                    selectBox.current.style.width = newWidth + "px";
                    selectBox.current.style.height = newHeight + "px";
                    
                    selectBox.current.style.left = mouseX + "px";
                    selectBox.current.style.top = mouseY + "px";
                }
    
                if (resize === "top-right") {
                    let mouseZeroX = mouseX - selectBox.current.getAttribute("mouse-start-resize-position-x");
                    let mouseZeroY = mouseY - selectBox.current.getAttribute("mouse-start-resize-position-y");
    
                    const newWidth = parseInt(boxWidth) + parseInt(mouseZeroX);
                    const newHeight = parseInt(boxHeight) - parseInt(mouseZeroY);
    
                    selectBox.current.style.width = newWidth + "px";
                    selectBox.current.style.height = newHeight + "px";
    
                    let modalTop = parseInt(selectBox.current.getAttribute("initial-modal-top"));
                    
                    selectBox.current.style.top = modalTop + parseInt(mouseZeroY) + "px";
                }
    
                applyRect();
            }
    
            if (tempTool === "rectangle" && rectangle.current.getAttribute("data-dragging") === "true") {
                let rectangleTop = parseInt(rectangle.current.getAttribute("mouse-start-resize-position-y"));
                let rectangleLeft = parseInt(rectangle.current.getAttribute("mouse-start-resize-position-x"));
    
                let newHeight = mouseY - rectangleTop;
                let newWidth = mouseX - rectangleLeft;
    
                let newTop = rectangleTop;
                let newLeft = rectangleLeft;
    
                if (newHeight < 0) {
                    newTop = mouseY;
                    newHeight = Math.abs(newHeight);
                }
    
                if (newWidth < 0) {
                    newLeft = mouseX;
                    newWidth = Math.abs(newWidth);
                }
    
    
                rectangle.current.style.height = newHeight + "px";
                rectangle.current.style.width = newWidth + "px";
                rectangle.current.style.top = newTop + "px";
                rectangle.current.style.left = newLeft + "px";
            }

            if (tempTool === "arrow" && line.current.getAttribute("data-dragging") === "true") {
                line.current.setAttribute("x2", mouseX);
                line.current.setAttribute("y2", mouseY);
            }
        });
    }, []);

    function applyRect(){
        if (!selectBox.current) return;

        let left = parseInt(selectBox.current.style.left.replace("px", ""));
        let top = parseInt(selectBox.current.style.top.replace("px", ""));
        let width = parseInt(selectBox.current.style.width.replace("px", ""));
        let height = parseInt(selectBox.current.style.height.replace("px", ""));

        left = left + 5;
        top = top + 5;
        width = width > 15 ? width - 15 : 0;
        height = height > 15 ? height - 15 : 0;

        rect.current.setAttribute("width", width);
        rect.current.setAttribute("height", height);
        rect.current.setAttribute("x", left);
        rect.current.setAttribute("y", top);

        left = left - 2;
        top = top - 2;

        borderRect.current.style.top = top + 'px';
        borderRect.current.style.left = left + 'px';
        borderRect.current.style.width = width + 'px';
        borderRect.current.style.height = height + 'px';

        if (width > 0 && height > 0) {
            borderRect.current.style.display = "block";
        }
        else {
            borderRect.current.style.display = "none";
        }
    }

    useEffect(() => {
        let input = document.getElementById("tool");

        if (input) {
            if (tool === null) {
                input.value = '';
            }
            else {
                input.value = tool;
            }
        }

    }, [tool]);

    function expand_selection() {
        let left = -5;
        let top = -5;
        let width = window.innerWidth + 15;
        let height = window.innerHeight + 15;

        selectBox.current.style.left = left + "px";
        selectBox.current.style.top = top + "px";
        selectBox.current.style.width = width + "px";
        selectBox.current.style.height = height + "px";

        applyRect();

        width = width - 20;
        height = height - 20;
        left = left + 5;
        top = top + 5;

        borderRect.current.style.width = width + 'px';
        borderRect.current.style.height = height + 'px';
        borderRect.current.style.top = top + 'px';
        borderRect.current.style.left = left + 'px';
    }

    function clear_selection() {
        selectBox.current.style.display = "none";

        let left = 0;
        let top = 0;
        let width = 0;
        let height = 0;

        selectBox.current.style.left = left + "px";
        selectBox.current.style.top = top + "px";
        selectBox.current.style.width = width + "px";
        selectBox.current.style.height = height + "px";

        applyRect();
    }

    function crop() {
        let tmp_canvas = document.createElement('canvas');
        tmp_canvas.width = rect.current.getAttribute("width");
        tmp_canvas.height = rect.current.getAttribute("height");

        let ctx = tmp_canvas.getContext('2d');
        ctx.drawImage(canvas.current, 
            rect.current.getAttribute("x"), 
            rect.current.getAttribute("y"), 
            rect.current.getAttribute("width"), 
            rect.current.getAttribute("height"), 0, 0, 
            rect.current.getAttribute("width"), 
            rect.current.getAttribute("height")
        );

        let data = tmp_canvas.toDataURL('image/png');

        return data;
    }

    function save() {
        let data = crop();
        ipcRenderer.send(functions.SAVE, data);
    }

    function copy() {
        let data = crop();
        ipcRenderer.send(functions.COPY, data);
    }

    function drawRectangle() {
        setTool("rectangle");
    }

    function drawArrow() {
        setTool("arrow");
    }

    function clear_tool() {
        setTool(null);
    }

    function textTool() {
        setTool("text");
    }

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            // backgroundSize: 'cover',
            // backgroundImage: `url(${image})`,
            overflow: 'hidden',
        }} id="image">
            <canvas ref={canvas} style={{
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100vw',
                height: '100vh',
                zIndex: '0',
            }}></canvas>

            <svg onClick={createTextbox} style={{
                width: '100vw',
                height: '100vw',
                position: 'fixed',
                top: '0',
                left: '0',
                zIndex: '1',
                cursor: tool === 'text' ? 'text' : 'default',
            }}>
                <mask id="svgmask">
                    <rect id="bg" x="0" y="0" width="100%" height="100%" fill="white"/>
                    <rect ref={rect} width="0" height="0" x="0" y="0" fill="black" />
                </mask>
                <rect ref={canvasForeground} id="bg" x="0" y="0" width="100%" height="100%" fill="rgba(0, 0, 0, 0.5)" mask="url(#svgmask)"/>
                <line ref={line} x1="0" y1="0" x2="0" y2="0" style={{
                    stroke: color,
                    strokeWidth: '3',
                    display: 'none',
                }} />
            </svg>

            <div ref={rectangle} style={{
                position: 'fixed',
                border: '3px solid ' + color,
                zIndex: '2',
                display: 'none',
            }}></div>

            <div ref={borderRect} style={{
                position: 'fixed',
                border: '2px dashed white',
                zIndex: '2',
                display: 'none',
            }}></div>

            <div ref={selectBox} style={{
                position: 'fixed',
                display: 'flex',
                flexDirection: 'column',
                opacity: '1',
                zIndex: '3',
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: '1',
                }}>
                    <div style={{
                        display: 'flex',
                        height: '10px',
                    }}>
                        <div style={{
                            width: '10px',
                            // backgroundColor: 'green',
                            cursor: tool === null ? 'se-resize' : 'default',
                            userSelect: 'none',
                        }} resize="top-left"></div>
                        <div style={{
                            flex: '1',
                            // backgroundColor: 'rgba(255,0,0,0.5)',
                            cursor: tool === null ? 's-resize' : 'default',
                            userSelect: 'none',
                        }} resize="top"></div>
                        <div style={{
                            width: '10px',
                            // backgroundColor: 'green',
                            cursor: tool === null ? 'sw-resize' : 'default',
                            userSelect: 'none',
                        }} resize="top-right"></div>
                    </div>
                    <div style={{
                        display: 'flex',
                        flex: '1',
                    }}>
                        <div style={{
                            width: '10px',
                            // backgroundColor: 'rgba(255,0,0,0.5)',
                            cursor: tool === null ? 'w-resize' : 'default',
                            userSelect: 'none',
                        }} resize="left"></div>
                        <div onClick={createTextbox} style={{
                            flex: '1',
                            cursor: tool === 'text' ? 'text' : 'default',
                        }}></div>
                        <div style={{
                            width: '10px',
                            // backgroundColor: 'rgba(255,0,0,0.5)',
                            cursor: tool === null ? 'w-resize' : 'default',
                            userSelect: 'none',
                        }} resize="right"></div>
                    </div>
                    <div style={{
                        display: 'flex',
                        height: '10px',
                    }}>
                        <div style={{
                            width: '10px',
                            // backgroundColor: 'green',
                            cursor: tool === null ? 'sw-resize' : 'default',
                            userSelect: 'none',
                        }} resize="bottom-left"></div>
                        <div style={{
                            flex: '1',
                            // backgroundColor: 'rgba(255,0,0,0.5)',
                            cursor: tool === null ? 's-resize' : 'default',
                            userSelect: 'none',
                        }} resize="bottom"></div>
                        <div style={{
                            width: '10px',
                            // backgroundColor: 'green',
                            cursor: tool === null ? 'se-resize' : 'default',
                            userSelect: 'none',
                        }} resize="bottom-right"></div>
                    </div>
                </div>
            </div>

            <div ref={textboxContainer} style={{
                zIndex: '4',
                position: 'fixed',
                display: 'none',
                gap: '5px',
                flexDirection: 'column',
                justifyContent: 'stretch',
            }}>
                <textarea ref={textbox} value={text} onChange={onChange} style={{
                    resize: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: color,
                    fontSize: '15pt',
                    fontFamily: 'Arial',
                    // fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    overflowWrap: 'normal',
                    border: '1px dashed ' + color,
                    minWidth: '100px',
                    minHeight: '30px',
                }}/>
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '5px',
                }}>
                    <button onClick={cancelTextbox} style={{
                        backgroundColor: '#fff',
                        padding: '5px',
                        borderRadius: '5px',
                        boxShadow: '0px 2px 5px rgba(0,0,0,0.5)',
                    }}><FontAwesomeIcon icon={faClose} /></button>
                    <button onClick={applyText} style={{
                        backgroundColor: '#fff',
                        padding: '5px',
                        borderRadius: '5px',
                        boxShadow: '0px 2px 5px rgba(0,0,0,0.5)',
                    }}><FontAwesomeIcon icon={faCheck} /></button>
                </div>
            </div>

            <div ref={toolbar} style={{
                position: 'fixed',
                left: '0',
                background: '#202020',
                color: 'white',
                display: 'none',
                padding: '5px',
                gap: '5px',
                borderRadius: '10px',
                alignItems: 'stretch',
                userSelect: 'none',
                zIndex: '5',
            }}>
                <div ref={toolbarDrag} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 10px',
                    cursor: 'grab',
                    opacity: '0.5',
                }}>
                    <FontAwesomeIcon icon={faGripVertical} />
                </div>
                <button style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Select All (Ctrl + A)" onClick={() => {
                    expand_selection();
                }}><FontAwesomeIcon icon={faExpand} /></button> 
                <button style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Clear Selection (Delete)" onClick={() => {
                    clear_selection();
                }}><FontAwesomeIcon icon={faTrash} /></button> 

                <div style={{
                    width: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        width: '1px',
                        height: '20px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                    }}></div>
                </div>

                <button style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Save (Ctrl + S)" onClick={() => {
                    save();
                }}><FontAwesomeIcon icon={faFloppyDisk} /></button> 
                <button style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Copy to Clipboard (Ctrl + C)" onClick={() => {
                    copy();
                }}><FontAwesomeIcon icon={faCopy} /></button> 
                <div style={{
                    width: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        width: '1px',
                        height: '20px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                    }}></div>
                </div>
                
                <button className={tool === null ? "button-selected" : ''} style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Select Area" onClick={() => {
                    clear_tool();
                }}><FontAwesomeIcon icon={faVectorSquare} /></button> 
            {/* }}><FontAwesomeIcon icon={faArrowPointer} /></button>  */}

                <button className={tool === "rectangle" ? "button-selected" : ''} style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Draw Rectangle" onClick={() => {
                    drawRectangle();
                }}><FontAwesomeIcon icon={faSquare} /></button> 

                <button className={tool === "arrow" ? "button-selected" : ''} style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Draw Arrow" onClick={() => {
                    drawArrow();
                }}><FontAwesomeIcon icon={faLeftLong} /></button>

                <button className={tool === "text" ? "button-selected" : ''} style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Insert Text" onClick={() => {
                    textTool();
                }}><FontAwesomeIcon icon={faFont} /></button> 

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <input type='color' id="color" style={{
                        display: 'block',
                        width: '0',
                        height: '0',
                        visibility: 'hidden',
                        transform: 'translate(0, -40px)',
                    }} tooltip="Color" onChange={(e) => {
                        let color = e.target.value;
                        setColor(color);
                    }} value={color} />
                    <button style={{
                        fontSize: '15pt',
                        padding: '10px',
                        borderRadius: '5px',
                        color: color,
                    }} tooltip="Color" onClick={() => {
                        let input = document.getElementById("color");
                        input.click();
                    }}><FontAwesomeIcon icon={faSquareFill} /></button>
                </div>                

                <div style={{
                    width: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        width: '1px',
                        height: '20px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                    }}></div>
                </div>

                <button style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Undo (Ctrl + Z)" onClick={() => {
                    undo();
                }}><FontAwesomeIcon icon={faArrowRotateLeft} /></button> 

                <div style={{
                    width: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        width: '1px',
                        height: '20px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                    }}></div>
                </div>
                <button style={{
                    fontSize: '15pt',
                    padding: '10px',
                    borderRadius: '5px',
                }} tooltip="Exit (Esc)" onClick={() => {
                    ipcRenderer.send(functions.CLOSE);
                }}><FontAwesomeIcon icon={faClose} /></button> 
            </div>

            {/* <div ref={cursor} style={{
                zIndex: '6',
                position: 'fixed',
                display: 'none',
            }}>
                {tool === null && <>
                    <FontAwesomeIcon style={{
                        stroke: 'white',
                        strokeWidth: '50px',
                        color: 'white',
                        width: '20px',
                    }} icon={faVectorSquare} />
                    <FontAwesomeIcon style={{
                        marginLeft: '-20px',
                        color: 'black',
                        width: '20px',
                    }} icon={faVectorSquare} />
                </>}
                {tool === 'rectangle' && <>
                    <FontAwesomeIcon style={{
                        stroke: 'white',
                        strokeWidth: '50px',
                        color: 'white',
                        width: '20px',
                    }} icon={faSquare} />
                    <FontAwesomeIcon style={{
                        marginLeft: '-20px',
                        color: 'black',
                        width: '20px',
                    }} icon={faSquare} />
                </>}
                {tool === 'arrow' && <>
                    <FontAwesomeIcon style={{
                        stroke: 'white',
                        strokeWidth: '50px',
                        color: 'white',
                        width: '20px',
                    }} icon={faLeftLong} />
                    <FontAwesomeIcon style={{
                        marginLeft: '-20px',
                        color: 'black',
                        width: '20px',
                    }} icon={faLeftLong} />
                </>}
            </div> */}
            <input type="hidden" id="tool" />
            <input type="hidden" id="x" />
            <input type="hidden" id="y" />
            <input type="hidden" id="w" />
            <input type="hidden" id="h" />
            <Tooltip />
        </div>
    );
}

export default App;
