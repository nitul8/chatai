import React from "react";

export const formatResponse = (text) => {
    if (!text) return null;

    const lines = text.split("\n").filter((line) => line.trim() !== "");

    return (
        <div className="space-y-4 text-base leading-relaxed">
            {lines.map((line, index) => {
                // Handle bold (**text**)
                const boldLine = line.replace(
                    /\*\*(.*?)\*\*/g,
                    "<strong>$1</strong>"
                );

                // Handle bullet points
                if (/^\s*[-*]\s+/.test(line)) {
                    return (
                        <ul key={index} className="list-disc ml-6">
                            <li
                                dangerouslySetInnerHTML={{
                                    __html: boldLine.slice(2),
                                }}
                            />
                        </ul>
                    );
                }

                // Handle numbered lists
                if (/^\s*\d+\.\s+/.test(line)) {
                    return (
                        <ol key={index} className="list-decimal ml-6">
                            <li
                                dangerouslySetInnerHTML={{
                                    __html: boldLine.replace(/^\d+\.\s+/, ""),
                                }}
                            />
                        </ol>
                    );
                }

                // Otherwise, just wrap it as paragraph
                return (
                    <p
                        key={index}
                        dangerouslySetInnerHTML={{__html: boldLine}}
                    />
                );
            })}
        </div>
    );
};
export default formatResponse;
