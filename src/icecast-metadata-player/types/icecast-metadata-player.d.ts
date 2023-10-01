declare module "icecast-metadata-player" {
  /** Icecast/Shoutcast ICY metadata values */
  export interface IcyMetadata {
    /** Stream or song title */
    StreamTitle?: string;

    /** Sometimes a URL for the cover photo of the currently playing stream,
     * or URI encoded string with artist, album, disc, etc.*/
    StreamUrl?: string;

    /** Sometimes present on newer Shoutcast servers indicating the next song */
    StreamNext?: string;
  }

  /**
   * Icecast Ogg Vorbis Comment metadata values
   *
   * See [xiph.org vorbis comments](https://xiph.org/vorbis/doc/v-comment.html)
   */
  export interface OggMetadata {
    /** Track/Work name */
    TITLE?: string;

    /** The version field may be used to differentiate multiple versions of the
     * same track title in a single collection. (e.g. remix info)*/
    VERSION?: string;

    /** The collection name to which this track belongs */
    ALBUM?: string;

    /** The track number of this piece if part of a specific larger collection or album */
    TRACKNUMBER?: string;

    /** The artist generally considered responsible for the work. In popular
     * music this is usually the performing band or singer. For classical music
     * it would be the composer. For an audio book it would be the author
     * of the original text. */
    ARTIST?: string;

    /** The artist(s) who performed the work. In classical music this would be the
     * conductor, orchestra, soloists. In an audio book it would be the actor who
     * did the reading. In popular music this is typically the same as the ARTIST
     * and is omitted. */
    PERFORMER?: string;

    /** Copyright attribution, e.g., '2001 Nobody's Band' or '1999 Jack Moffitt' */
    COPYRIGHT?: string;

    /** License information, for example, 'All Rights Reserved', 'Any Use Permitted',
     * a URL to a license such as a Creative Commons license
     * (e.g. "creativecommons.org/licenses/by/4.0/"), or similar.*/
    LICENSE?: string;

    /** Name of the organization producing the track (i.e. the 'record label') */
    ORGANIZATION?: string;

    /** A short text description of the contents */
    DESCRIPTION?: string;

    /** A short text indication of music genre */
    GENRE?: string;

    /** Date the track was recorded */
    DATE?: string;

    /** Location where track was recorded */
    LOCATION?: string;

    /** Contact information for the creators or distributors of the track. This
     * could be a URL, an email address, the physical address of the producing label. */
    CONTACT?: string;

    /** ISRC number for the track; see the ISRC intro page for more information
     * on ISRC numbers. */
    ISRC?: string;

    /** Name and version of the application used to encode the stream */
    VENDOR_STRING?: string;
  }

  interface IcecastMetadataPlayerOptions {
    /**
     * Order to select the next endpoint when a list of endpoints is provided.
     * @default "ordered"
     */
    endpointOrder?: "ordered" | "random";

    /**
     * Number of seconds to buffer before starting playback
     * @default 1
     */
    bufferLength?: number;

    /**
     * Number of seconds to wait before giving up on retries
     * @default 30
     */
    retryTimeout?: number;

    /**
     * Percentage of seconds to increment after each retry (how quickly to increase the back-off)
     * @default 0.1
     */
    retryDelayRate?: number;

    /**
     * Minimum number of seconds between retries (start of the exponential back-off curve)
     * @default 0.5
     */
    retryDelayMin?: number;

    /**
     * Maximum number of seconds between retries (end of the exponential back-off curve)
     * @default 2
     */
    retryDelayMax?: number;

    /**
     * Set to `true` to enable warning and error logging to the console
     * @default false
     */
    enableLogging?: boolean;

    /**
     * Sets the preferred playback method.
     * @default "mediasource"
     */
    playbackMethod?: "mediasource" | "webaudio" | "html5";

    /**
     * Sets authentication credentials used for authenticating to private streams
     */
    authentication?: {
      user: string;
      password: string;
    };
  }

  interface IcecastMetadataPlayerCallbacks {
    /**
     * Audio element to play the stream
     * @default new Audio();
     */
    audioElement?: HTMLAudioElement;

    /** Called when the audio element begins playing */
    onPlay?: () => void;

    /** Called when stream request is started */
    onLoad?: () => void;

    /** Called when stream requests begins to return data */
    onStreamStart?: () => void;

    /** Called when the audio buffer is being filled */
    onBuffer?: (time: number) => void;

    /** Called when stream data is sent to the audio element */
    onStream?: (streamData: Uint8Array) => void;

    /** Called when the stream request completes */
    onStreamEnd?: () => void;

    /** Called when the audio codec information has changed */
    onCodecUpdate?: (codecInformation: object) => void;

    /** Called when the stream is completely stopped and all cleanup operations are complete */
    onStop?: () => void;

    /** Called when a connection retry is attempted */
    onRetry?: () => void;

    /** Called when when retry connections attempts have timed out */
    onRetryTimeout?: () => void;

    /** Called when a switch event is triggered */
    onSwitch?: () => void;

    /** Called with message(s) when a warning condition is met */
    onWarn?: (...messages: [string]) => void;

    /** Called with a message and an Error object when a fallback or error condition is met */
    onError?: (message: string, error?: Error) => void;
  }

  /**
   * IcecastMetadataPlayer `options` parameter when there is icy metadata
   */
  export interface IcecastMetadataPlayerIcyOptions
    extends IcecastMetadataPlayerOptions {
    /** Array of metadata types to parse */
    metadataTypes?: ["icy"];

    /** ICY metadata interval */
    icyMetaInt?: number;

    /** Character encoding to use for ICY metadata (defaults to "utf-8")
     * @default "utf-8"
     */
    icyCharacterEncoding?: string;

    /** ICY metadata detection timeout
     * @default 2000
     */
    icyDetectionTimeout?: number;
  }

  export interface IcecastMetadataPlayerIcyOptionsWithCallbacks
    extends IcecastMetadataPlayerIcyOptions,
      IcecastMetadataPlayerCallbacks {
    /** Called with metadata when synchronized with the audio */
    onMetadata?: (
      metadata: IcyMetadata,
      timestampOffset: number,
      timestamp: number,
    ) => void;

    /** Called with metadata when discovered on the response */
    onMetadataEnqueue?: (
      metadata: IcyMetadata,
      timestampOffset: number,
      timestamp: number,
    ) => void;
  }

  /**
   * IcecastMetadataPlayer `options` parameter when there is ogg metadata
   */
  export interface IcecastMetadataPlayerOggOptions
    extends IcecastMetadataPlayerOptions {
    /** Array of metadata types to parse */
    metadataTypes: ["ogg"];
  }

  export interface IcecastMetadataPlayerOggOptionsWithCallbacks
    extends IcecastMetadataPlayerOggOptions,
      IcecastMetadataPlayerCallbacks {
    /** Called with metadata when synchronized with the audio */
    onMetadata?: (
      metadata: OggMetadata,
      timestampOffset: number,
      timestamp: number,
    ) => void;

    /** Called with metadata when discovered on the response */
    onMetadataEnqueue?: (
      metadata: OggMetadata,
      timestampOffset: number,
      timestamp: number,
    ) => void;
  }

  /**
   * IcecastMetadataPlayer `options` parameter when there is icy and ogg metadata
   */
  export interface IcecastMetadataPlayerIcyOggOptions
    extends IcecastMetadataPlayerOptions {
    /** Array of metadata types to parse */
    metadataTypes: ["icy", "ogg"];

    /** ICY metadata interval */
    icyMetaInt?: number;

    /** ICY metadata detection timeout
     * @default 2000
     */
    icyDetectionTimeout?: number;
  }

  export interface IcecastMetadataPlayerIcyOggOptionsWithCallbacks
    extends IcecastMetadataPlayerIcyOggOptions,
      IcecastMetadataPlayerCallbacks {
    /** Called with metadata when synchronized with the audio */
    onMetadata?: (
      metadata: IcyMetadata & OggMetadata,
      timestampOffset: number,
      timestamp: number,
    ) => void;

    /** Called with metadata when discovered on the response */
    onMetadataEnqueue?: (
      metadata: IcyMetadata & OggMetadata,
      timestampOffset: number,
      timestamp: number,
    ) => void;
  }

  /**
   * IcecastMetadataPlayer `options` parameter when there is no metadata
   */
  export interface IcecastMetadataPlayerNoMetadataOptions
    extends IcecastMetadataPlayerOptions {
    /** Array of metadata types to parse */
    metadataTypes: [];
  }

  export interface IcecastMetadataPlayerNoMetadataOptionsWithCallbacks
    extends IcecastMetadataPlayerNoMetadataOptions,
      IcecastMetadataPlayerCallbacks {
    /** Metadata callbacks are not allowed if there is no metadata being parsed */
    onMetadata?: undefined;

    /** Metadata callbacks are not allowed if there is no metadata being parsed */
    onMetadataEnqueue?: undefined;
  }

  class IcecastMetadataPlayer extends EventTarget {
    /**
     * Tests if the passed in mime-type can be played.
     *
     * Follows the [HTML5MediaElement canPlayType()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canPlayType) API:
     *
     * `""` - Cannot play the codec
     *
     * `"maybe"` - Might be able to play the codec
     *
     * `"probably"` - Should be able to play the codec
     */
    static canPlayType(mimeType: string): {
      mediasource: "" | "maybe" | "probably";
      html5: "" | "maybe" | "probably";
    };

    constructor(
      /** HTTP(s) endpoint for the Icecast compatible stream. */
      endpoints: string | string[],
      options?:
        | IcecastMetadataPlayerIcyOptionsWithCallbacks
        | IcecastMetadataPlayerOggOptionsWithCallbacks
        | IcecastMetadataPlayerIcyOggOptionsWithCallbacks
        | IcecastMetadataPlayerNoMetadataOptionsWithCallbacks,
    );

    addEventListener(
      type:
        | "buffer"
        | "play"
        | "load"
        | "streamstart"
        | "stream"
        | "streamend"
        | "metadata"
        | "metadataenqueue"
        | "codecupdate"
        | "stop"
        | "retry"
        | "retrytimeout"
        | "switch"
        | "warn"
        | "error",
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void;

    removeEventListener(
      type:
        | "buffer"
        | "play"
        | "load"
        | "streamstart"
        | "stream"
        | "streamend"
        | "metadata"
        | "metadataenqueue"
        | "codecupdate"
        | "stop"
        | "retry"
        | "retrytimeout"
        | "switch"
        | "warn"
        | "error",
      callback: EventListenerOrEventListenerObject | null,
      options?: EventListenerOptions | boolean,
    ): void;

    /** Returns audio element that is currently attached to this instance */
    get audioElement(): HTMLAudioElement;

    /** Returns the current endpoint being played */
    get endpoint(): string;

    /** Returns the detected or passed in icy metadata interval in number of bytes */
    get icyMetaInt(): number;

    /** Returns the current state of the IcecastMetadataPlayer */
    get state():
      | "loading"
      | "playing"
      | "stopping"
      | "stopped"
      | "retrying"
      | "switching";

    /** Returns the audio playback method being used */
    get playbackMethod(): "mediasource" | "webaudio" | "html5" | "";

    /** Returns the array of enqueued `metadata` in FIFO order */
    get metadataQueue(): {
      metadata: IcyMetadata & OggMetadata;
      timestampOffset: number;
      timestamp: number;
    }[];

    /** Plays the Icecast Stream */
    play(): Promise<void>;

    /** Stops the Icecast Stream */
    stop(): Promise<void>;

    /** Switches the stream endpoint during playback */
    switchEndpoint(
      endpoints: string | string[],
      options?:
        | IcecastMetadataPlayerIcyOptions
        | IcecastMetadataPlayerOggOptions
        | IcecastMetadataPlayerIcyOggOptions
        | IcecastMetadataPlayerNoMetadataOptions,
    ): Promise<void>;

    /** Removes the audio element from this instance and stops the Icecast Stream */
    detachAudioElement(): Promise<void>;
  }

  export default IcecastMetadataPlayer;
}
