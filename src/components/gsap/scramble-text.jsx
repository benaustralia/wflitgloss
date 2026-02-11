"use client";
import { useEffect, useRef } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";

gsap.registerPlugin(ScrambleTextPlugin);

const defaultChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const ScrambleText = ({
    scrambleOnLoad = true,
    random = true,
    chars: customChars,
    ...props
}) => {
    const wrapperRef = useRef(null);

    const { contextSafe } = useGSAP();

    const scramble = contextSafe(() => {
        const target = wrapperRef.current;
        if (gsap.isTweening(target) || !target) return;
        gsap.to(target, {
            duration: 1,
            ease: "sine.in",
            scrambleText: {
                text: target.innerText,
                speed: 2,
                chars: customChars || (random ? defaultChars : target.innerText.replace(/\s/g, "")),
            },
        });
    });

    useEffect(() => {
        if (scrambleOnLoad) scramble();
        const target = wrapperRef.current;
        target?.addEventListener("pointerenter", scramble);

        // Re-scramble every time the element scrolls into view
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) scramble(); },
            { threshold: 0.1 }
        );
        if (target) observer.observe(target);

        return () => {
            target?.removeEventListener("pointerenter", scramble);
            observer.disconnect();
        };
    }, [wrapperRef, scramble, scrambleOnLoad]);

    return <div {...props} ref={wrapperRef} />;
};
