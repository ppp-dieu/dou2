"use client";

function limitName(value: string) {
    return Array.from(value).slice(0, 10).join("");
}

type NameInputProps = {
    name: string;
    onNameChange: (name: string) => void;
};

export default function NameInput({
    name,
    onNameChange,
}: NameInputProps) {
    return (
        <input
            type="text"
            value={name}
            onChange={(event) =>
                onNameChange(limitName(event.target.value))
            }
            placeholder="名前を入力（10文字以内）"
            className="mx-auto block h-10 w-full max-w-sm rounded-md border border-gray-500 bg-white px-4 text-base text-[#2F4544] outline-none placeholder:text-[#B8B8B8] focus:border-[#49B8B1]"
        />
    );
}