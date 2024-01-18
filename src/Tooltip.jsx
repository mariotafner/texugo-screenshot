"use client";
import { useEffect } from "react"

export default function Tooltip(props){
    useEffect(() => {
        document.addEventListener('mouseover', function(evt) {
            let elm = null
            if (evt.target.getAttribute('tooltip'))
                elm = evt.target
            else {
                let node = evt.target.parentNode;
                while (node) {
                    if (node instanceof Element){
                        if (node.getAttribute('tooltip')) {
                            elm = node
                            break
                        }
                    }
                    node = node.parentNode;
                }
            }

            if (elm){
                let tooltip_postion = elm.getAttribute('tooltip-position') || 'top'
                
                let tooltip = document.getElementById('tooltip')
                let tooltip_box = document.getElementById('tooltip-box')
                let tooltip_arrow = document.getElementById('tooltip-arrow')

                tooltip_box.innerText = elm.getAttribute('tooltip')
                tooltip.style.display = 'flex'
                const rect = elm.getBoundingClientRect();

                if (tooltip_postion === 'top'){
                    tooltip.style.left = rect.left + (elm.clientWidth / 2) - (tooltip.clientWidth / 2) + 'px'
                    tooltip.style.top = rect.top - tooltip.clientHeight - 3 + 'px'
                    tooltip.style.flexDirection = 'column'
                    tooltip_arrow.style.marginTop = '-5px'
                    tooltip_arrow.style.marginLeft = '0px'
                    tooltip_arrow.style.marginRight = '0px'
                    tooltip_arrow.style.marginBottom = '0px'
                }
                else if (tooltip_postion === 'bottom'){
                    tooltip.style.left = rect.left + (elm.clientWidth / 2) - (tooltip.clientWidth / 2) + 'px'
                    tooltip.style.top = rect.top + elm.clientHeight + 9 + 'px'
                    tooltip.style.flexDirection = 'column-reverse'
                    tooltip_arrow.style.marginBottom = '-5px'
                    tooltip_arrow.style.marginLeft = '0px'
                    tooltip_arrow.style.marginRight = '0px'
                }
                else if (tooltip_postion === 'left'){
                    tooltip.style.left = rect.left - tooltip.clientWidth - 2 + 'px'
                    tooltip.style.top = rect.top + (elm.clientHeight / 2) - (tooltip.clientHeight / 2) + 'px'
                    tooltip.style.flexDirection = 'row'
                    tooltip_arrow.style.marginLeft = '-5px'
                    tooltip_arrow.style.marginTop = '0px'
                }
                else if (tooltip_postion === 'right'){
                    tooltip.style.left = rect.left + elm.clientWidth + 5 + 'px'
                    tooltip.style.top = rect.top + (elm.clientHeight / 2) - (tooltip.clientHeight / 2) + 'px'
                    tooltip.style.flexDirection = 'row-reverse'
                    tooltip_arrow.style.marginRight = '-5px'
                    tooltip_arrow.style.marginTop = '0px'
                }

                let theme = elm.getAttribute('tooltip-theme') || 'dark'
                if (theme === 'dark'){
                    tooltip_arrow.style.backgroundColor = '#000'
                    tooltip_box.style.backgroundColor = '#000'
                    tooltip_box.style.color = '#fff'
                }
                else if (theme === 'light'){
                    tooltip_arrow.style.backgroundColor = '#fff'
                    tooltip_box.style.backgroundColor = '#fff'
                    tooltip_box.style.color = '#000'
                }
                
            }
        }, false);
        document.addEventListener('mouseout', function(evt) {
            let tooltip = document.getElementById('tooltip')
            if (tooltip){
                tooltip.style.display = 'none'
            }
        }, false);
    }, []);

    return (
        <div id="tooltip" style={{
            position: 'absolute',
            top: '0px',
            left: '0px',
            display: 'none',
            flexDirection: 'column',
            justifyContent: 'center',
            width: 'fit-content',
            alignItems: 'center',
            zIndex: '999999'
        }}>
            <div id="tooltip-box" style={{
                padding: '5px 10px',
                borderRadius: '5px',
            }}></div>
            <div id="tooltip-arrow" style={{
                width: '10px',
                height: '10px',
                transform: 'rotate(45deg)',
                marginTop: '-5px',
            }}></div>
        </div>
    )
}
