import { useState } from "react";
import { ArrowLeft, Moon, Settings as SettingsIcon, Sun, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  loadSettings, saveSettings,
} from "@/lib/offline-game";
import { setSoundEnabled } from "@/lib/sounds";
import { AppView } from "./HomeView";

interface SettingsViewProps {
  onNavigate: (view: AppView) => void;
}

export function SettingsView({ onNavigate }: SettingsViewProps) {
  const [settings, setSettings] = useState(loadSettings);

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    setSoundEnabled(next.soundEnabled);
    if (patch.theme) {
      document.documentElement.classList.toggle("dark", patch.theme === "dark");
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
        <Card className="border-white/30 shadow-2xl">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center gap-2 text-2xl font-black text-white">
              <SettingsIcon className="h-6 w-6" /> Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-secondary p-3.5">
              <Label className="text-sm font-semibold">Sound Effects</Label>
              <Button
                variant="outline" size="sm"
                onClick={() => update({ soundEnabled: !settings.soundEnabled })}
              >
                {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {settings.soundEnabled ? "On" : "Off"}
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary p-3.5">
              <Label className="text-sm font-semibold">Music</Label>
              <Button
                variant="outline" size="sm" disabled
                title="Coming soon"
              >
                {settings.musicEnabled ? "On" : "Off"} (soon)
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary p-3.5">
              <Label className="text-sm font-semibold">Theme</Label>
              <div className="flex gap-1.5">
                <Button
                  variant={settings.theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => update({ theme: "light" })}
                >
                  <Sun className="h-4 w-4" /> Light
                </Button>
                <Button
                  variant={settings.theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => update({ theme: "dark" })}
                >
                  <Moon className="h-4 w-4" /> Dark
                </Button>
              </div>
            </div>

            <Button variant="outline" className="h-11 w-full" onClick={() => onNavigate("home")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
