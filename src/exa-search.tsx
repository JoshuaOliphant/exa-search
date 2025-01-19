import {
  Action,
  ActionPanel,
  List,
  getPreferenceValues,
  showToast,
  Toast,
  Icon,
  LocalStorage,
} from "@raycast/api";
import React, { useState, useEffect } from "react";
import fetch from "node-fetch";

type Preferences = {
  exaApiKey: string;
  searchMode: "realtime" | "manual";
};

type ExaSearchResult = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  published_date?: string;
};

type ExaApiResponse = {
  results: ExaSearchResult[];
  total: number;
};

// LocalStorage key for search mode
const SEARCH_MODE_STORAGE_KEY = "exa-search-mode";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<ExaSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minQueryLength = 3;

  // Get initial preferences
  const preferences = getPreferenceValues<Preferences>();
  
  // State for search mode with localStorage
  const [searchMode, setSearchMode] = useState<"realtime" | "manual">(preferences.searchMode);

  // Load stored search mode on mount
  useEffect(() => {
    async function loadStoredMode() {
      try {
        const storedMode = await LocalStorage.getItem<string>(SEARCH_MODE_STORAGE_KEY);
        if (storedMode === "realtime" || storedMode === "manual") {
          setSearchMode(storedMode);
        }
      } catch (error) {
        console.error("Error loading search mode:", error);
      }
    }
    loadStoredMode();
  }, []);

  // Function to toggle search mode
  async function toggleSearchMode() {
    const newMode = searchMode === "realtime" ? "manual" : "realtime";
    setSearchMode(newMode);
    try {
      await LocalStorage.setItem(SEARCH_MODE_STORAGE_KEY, newMode);
      showToast({
        style: Toast.Style.Success,
        title: `Switched to ${newMode === "realtime" ? "real-time" : "manual"} search`,
      });
    } catch (error) {
      console.error("Error saving search mode:", error);
    }
  }

  async function searchExa(query: string) {
    if (!query || query.trim().length < minQueryLength) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": preferences.exaApiKey,
        },
        body: JSON.stringify({
          query: query.trim(),
          num_results: 10,
          use_autoprompt: true,
          include_domains: [],
          exclude_domains: [],
          source_type: "search"
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      showToast(Toast.Style.Failure, "Search failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearchTextChange(newText: string) {
    setSearchText(newText);
    if (!newText.trim()) {
      setResults([]);
    }
  }

  useEffect(() => {
    if (searchMode !== "realtime") {
      return;
    }

    if (searchText.trim().length < minQueryLength) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchExa(searchText);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchText, searchMode]);

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={handleSearchTextChange}
      searchBarPlaceholder={
        searchMode === "manual" 
          ? "Type and press ↵ to search with Exa AI..." 
          : "Start typing to search with Exa AI..."
      }
      throttle
      searchBarAccessory={
        <List.Dropdown
          tooltip="Search Mode"
          value={searchMode}
          onChange={async (newValue) => {
            const mode = newValue as "realtime" | "manual";
            setSearchMode(mode);
            await LocalStorage.setItem(SEARCH_MODE_STORAGE_KEY, mode);
            showToast({
              style: Toast.Style.Success,
              title: `Switched to ${mode === "realtime" ? "real-time" : "manual"} search`,
            });
          }}
        >
          <List.Dropdown.Item title="Real-time Search" value="realtime" icon={Icon.Play} />
          <List.Dropdown.Item title="Manual Search" value="manual" icon={Icon.Pause} />
        </List.Dropdown>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {searchMode === "manual" && (
              <Action
                title="Search"
                onAction={() => searchExa(searchText)}
                shortcut={{ modifiers: [], key: "return" }}
                icon={Icon.MagnifyingGlass}
              />
            )}
            <Action
              title={`Switch to ${searchMode === "realtime" ? "manual" : "real-time"} search`}
              onAction={toggleSearchMode}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              icon={searchMode === "realtime" ? Icon.Pause : Icon.Play}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.OpenInBrowser
              title="View Exa API Documentation"
              url="https://docs.exa.ai/reference/search"
              icon={Icon.Document}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      {error ? (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Error"
          description={error}
        />
      ) : results.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title={
            !searchText.trim()
              ? "Enter your search terms"
              : searchText.trim().length < minQueryLength
              ? `Type at least ${minQueryLength} characters`
              : searchMode === "manual"
              ? "Press ↵ to search"
              : "No results found"
          }
          description={
            searchMode === "manual"
              ? "Press ↵ to search or ⌘T to toggle search mode"
              : "Results will appear as you type. Press ⌘T to toggle search mode"
          }
        />
      ) : (
        results.map((item) => (
          <List.Item
            key={item.id}
            icon={Icon.Link}
            title={item.title}
            subtitle={item.snippet}
            accessories={[
              { 
                text: item.published_date 
                  ? new Date(item.published_date).toLocaleDateString() 
                  : undefined 
              }
            ]}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.OpenInBrowser url={item.url} />
                  <Action.CopyToClipboard
                    content={item.url}
                    title="Copy Link"
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                  <Action
                    title={`Switch to ${searchMode === "realtime" ? "manual" : "real-time"} search`}
                    onAction={toggleSearchMode}
                    shortcut={{ modifiers: ["cmd"], key: "t" }}
                    icon={searchMode === "realtime" ? Icon.Pause : Icon.Play}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}