import { cn } from "@follow/utils"
import { HeaderTitle } from "@react-navigation/elements"
import { router, Stack, useNavigation } from "expo-router"
import type { FC, PropsWithChildren, ReactNode } from "react"
import { createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { LayoutChangeEvent } from "react-native"
import { StyleSheet, TouchableOpacity, View } from "react-native"
import type { AnimatedProps } from "react-native-reanimated"
import Animated, {
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import type { DefaultStyle } from "react-native-reanimated/lib/typescript/hook/commonTypes"
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context"
import type { NativeStackNavigationOptions } from "react-native-screens/lib/typescript/native-stack/types"
import type { ViewProps } from "react-native-svg/lib/typescript/fabric/utils"
import { useColor } from "react-native-uikit-colors"

import { MingcuteLeftLineIcon } from "@/src/icons/mingcute_left_line"

import { ThemedBlurView } from "../../common/ThemedBlurView"
import { getDefaultHeaderHeight } from "../utils"
import { NavigationContext } from "../views/NavigationContext"
import { SetNavigationHeaderHeightContext } from "../views/NavigationHeaderContext"

export interface NavigationHeaderRawProps {
  headerLeft?: FC<{
    canGoBack: boolean
  }>
  headerTitle?: FC<React.ComponentProps<typeof HeaderTitle>> | ReactNode
  headerTitleAbsolute?: boolean
  headerRight?: FC<{
    canGoBack: boolean
  }>

  title?: string

  modal?: boolean
  hideableBottom?: ReactNode
  hideableBottomHeight?: number
}

const useHideableBottom = (
  enable: boolean,
  originalDefaultHeaderHeight: number,
  hideableBottomHeight?: number,
) => {
  const lastScrollY = useRef(0)

  const largeDefaultHeaderHeightRef = useRef(
    originalDefaultHeaderHeight + (hideableBottomHeight || 0),
  )
  const largeHeaderHeight = useSharedValue(originalDefaultHeaderHeight)
  const [hideableBottomRef, setHideableBottomRef] = useState<View | undefined>()

  useEffect(() => {
    hideableBottomRef?.measure((x, y, width, height) => {
      const largeHeight = height + originalDefaultHeaderHeight
      largeDefaultHeaderHeightRef.current = largeHeight
      largeHeaderHeight.value = largeHeight
    })
  }, [hideableBottomRef, largeHeaderHeight, originalDefaultHeaderHeight])

  const { scrollY } = useContext(NavigationContext)!
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      if (!enable) {
        return
      }

      const largeDefaultHeaderHeight = largeDefaultHeaderHeightRef.current

      if (value <= 100) {
        largeHeaderHeight.value = withTiming(largeDefaultHeaderHeight)
      } else if (value > lastScrollY.current) {
        largeHeaderHeight.value = withTiming(originalDefaultHeaderHeight)
      } else {
        largeHeaderHeight.value = withTiming(largeDefaultHeaderHeight)
      }
      lastScrollY.current = value
    })

    return () => {
      scrollY.removeListener(id)
    }
  }, [enable, largeHeaderHeight, originalDefaultHeaderHeight, scrollY])

  const layoutHeightOnceRef = useRef(false)
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (typeof hideableBottomHeight === "number") {
        return
      }
      const { height } = e.nativeEvent.layout

      if (!height) return
      if (layoutHeightOnceRef.current) {
        return
      }

      layoutHeightOnceRef.current = true

      largeDefaultHeaderHeightRef.current = height + originalDefaultHeaderHeight
      largeHeaderHeight.value = largeDefaultHeaderHeightRef.current
    },
    [hideableBottomHeight, largeHeaderHeight, originalDefaultHeaderHeight],
  )
  return {
    hideableBottomRef,
    setHideableBottomRef,
    largeHeaderHeight,
    largeDefaultHeaderHeightRef,
    onLayout,
  }
}
interface NavigationHeaderProps
  extends Omit<AnimatedProps<ViewProps>, "children">,
    NavigationHeaderRawProps,
    PropsWithChildren {}

const blurThreshold = 0
const titlebarPaddingHorizontal = 8
const titleMarginHorizontal = 16
export const InternalNavigationHeader = ({
  style,
  children,
  headerLeft,
  headerRight,
  title,
  headerTitle: customHeaderTitle,
  modal = false,
  hideableBottom,
  hideableBottomHeight,
  headerTitleAbsolute,
  ...rest
}: NavigationHeaderProps) => {
  const insets = useSafeAreaInsets()
  const frame = useSafeAreaFrame()
  const defaultHeight = useMemo(
    () => getDefaultHeaderHeight(frame, modal, modal ? 0 : insets.top),
    [frame, insets.top, modal],
  )

  const border = useColor("opaqueSeparator")
  const opacityAnimated = useSharedValue(0)
  const { scrollY } = useContext(NavigationContext)!

  const setHeaderHeight = useContext(SetNavigationHeaderHeightContext)

  useEffect(() => {
    const handler = ({ value }: { value: number }) => {
      opacityAnimated.value = Math.max(0, Math.min(1, (value + blurThreshold) / 10))
    }
    const id = scrollY.addListener(handler)

    handler({ value: (scrollY as any)._value })
    return () => {
      scrollY.removeListener(id)
    }
  }, [opacityAnimated, scrollY])

  const blurStyle = useAnimatedStyle(() => ({
    opacity: opacityAnimated.value,
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: border,
  }))

  const { setHideableBottomRef, largeHeaderHeight, onLayout } = useHideableBottom(
    !!hideableBottom,
    defaultHeight,
    hideableBottomHeight,
  )
  const rootTitleBarStyle = useAnimatedStyle(() => {
    const styles = {
      paddingTop: modal ? 0 : insets.top,
      position: "relative",
      overflow: "hidden",
    } satisfies DefaultStyle
    if (hideableBottom) {
      ;(styles as DefaultStyle).height = largeHeaderHeight.value
    }
    return styles
  })

  const navigation = useNavigation()
  const canBack = navigation.canGoBack()
  useEffect(() => {
    if (title) {
      navigation.setOptions({ title })
    }
  }, [navigation, title])

  const HeaderLeft = headerLeft ?? DefaultHeaderBackButton

  const renderTitle = customHeaderTitle ?? HeaderTitle
  const headerTitle =
    typeof renderTitle !== "function"
      ? renderTitle
      : createElement(renderTitle, {
          children: title,
        })
  const RightButton = headerRight ?? Noop

  const animatedRef = useAnimatedRef<Animated.View>()
  useEffect(() => {
    animatedRef.current?.measure((x, y, width, height) => {
      setHeaderHeight?.(height)
    })
  }, [animatedRef, setHeaderHeight])

  return (
    <Animated.View
      ref={animatedRef}
      pointerEvents={"box-none"}
      {...rest}
      style={[rootTitleBarStyle, style]}
      onLayout={useCallback(
        (e: LayoutChangeEvent) => {
          setHeaderHeight?.(e.nativeEvent.layout.height)
        },
        [setHeaderHeight],
      )}
    >
      <Animated.View style={blurStyle} pointerEvents={"none"}>
        <ThemedBlurView className="flex-1" />
      </Animated.View>

      {/* Grid */}

      <View
        className="relative flex-row items-center"
        style={{
          marginLeft: insets.left,
          marginRight: insets.right,
          height: !modal ? defaultHeight - insets.top : defaultHeight,
          paddingHorizontal: titlebarPaddingHorizontal,
        }}
        pointerEvents={"box-none"}
      >
        {/* Left */}
        <View
          className="min-w-6 flex-1 flex-row items-center justify-start"
          pointerEvents={"box-none"}
        >
          <HeaderLeft canGoBack={canBack} />
        </View>
        {/* Center */}

        <Animated.View
          className="items-center justify-center"
          pointerEvents={"box-none"}
          style={{
            marginHorizontal: titleMarginHorizontal,
          }}
        >
          {headerTitleAbsolute ? <View /> : headerTitle}
        </Animated.View>

        {/* Right */}
        <View
          className="min-w-6 flex-1 flex-row items-center justify-end"
          pointerEvents={"box-none"}
        >
          <RightButton canGoBack={canBack} />
        </View>
        <View
          className="absolute inset-0 flex-row items-center justify-center"
          pointerEvents={"box-none"}
        >
          {headerTitleAbsolute && headerTitle}
        </View>
      </View>

      {!!hideableBottom && (
        <View ref={setHideableBottomRef as any} onLayout={onLayout}>
          {hideableBottom}
        </View>
      )}
    </Animated.View>
  )
}

export const DefaultHeaderBackButton = ({ canGoBack }: { canGoBack: boolean }) => {
  const label = useColor("label")
  if (!canGoBack) return null
  return (
    <UINavigationHeaderActionButton onPress={() => router.back()}>
      <MingcuteLeftLineIcon height={20} width={20} color={label} />
    </UINavigationHeaderActionButton>
  )
}

export const UINavigationHeaderActionButton = ({
  children,
  onPress,
  disabled,
  className,
}: {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  className?: string
}) => {
  return (
    <TouchableOpacity
      hitSlop={5}
      className={cn("p-2", className)}
      onPress={onPress}
      disabled={disabled}
    >
      {children}
    </TouchableOpacity>
  )
}
const Noop = () => null

/**
 * NativeNavigationHeader wrapped react navigation native-stack is universal in modal and stack, but there are significant limitations in UI customization.
 */
export interface NativeNavigationHeaderProps
  extends Pick<NativeStackNavigationOptions, "headerLeft" | "headerRight" | "headerTitle"> {}
export const NativeNavigationHeader: FC<NativeNavigationHeaderProps> = (props) => {
  const navigation = useNavigation()
  return (
    <Stack.Screen
      options={{
        headerShown: true,

        headerLeft: () => <DefaultHeaderBackButton canGoBack={navigation.canGoBack()} />,
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterial",
        ...props,
      }}
    />
  )
}
