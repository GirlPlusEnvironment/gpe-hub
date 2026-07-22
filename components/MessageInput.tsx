import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
  onSend: (content: string, listingId?: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

const MessageInput = ({ onSend, disabled = false, placeholder = "Type a message..." }: MessageInputProps) => {
  const [message, setMessage] = useState("");

  const handleSend = async () => {
    if (!message.trim() || disabled) return;

    const content = message.trim();
    setMessage("");
    await onSend(content);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex min-w-0 items-end gap-2">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="max-h-[200px] min-h-[52px] min-w-0 resize-none sm:min-h-[60px]"
        rows={1}
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        size="icon"
        className="h-[52px] w-[52px] flex-shrink-0 sm:h-[60px] sm:w-[60px]"
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default MessageInput;
