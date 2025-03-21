import { UserAvatar } from "@client/components/ui/user-avatar"
import { createSession, loginHandler, signOut, twoFactor } from "@client/lib/auth"
import { queryClient } from "@client/lib/query-client"
import { useSession } from "@client/query/auth"
import { useAuthProviders } from "@client/query/users"
import { Logo } from "@follow/components/icons/logo.jsx"
import { Button, MotionButtonBase } from "@follow/components/ui/button/index.js"
import { Divider } from "@follow/components/ui/divider/index.js"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@follow/components/ui/form/index.jsx"
import { Input } from "@follow/components/ui/input/index.js"
import { LoadingCircle } from "@follow/components/ui/loading/index.jsx"
import { authProvidersConfig } from "@follow/constants"
import { DEEPLINK_SCHEME } from "@follow/shared/constants"
import { env } from "@follow/shared/env"
import { cn } from "@follow/utils/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReCAPTCHA from "react-google-recaptcha"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"
import { z } from "zod"

export function Login() {
  const { status, refetch } = useSession()

  const [redirecting, setRedirecting] = useState(false)

  const { data: authProviders, isLoading } = useAuthProviders()

  const location = useLocation()
  const urlParams = new URLSearchParams(location.search)
  const provider = urlParams.get("provider")
  const isCredentialProvider = provider === "credential"

  const isAuthenticated = status === "authenticated"

  const { t } = useTranslation("external")

  useEffect(() => {
    if (provider && !isCredentialProvider && status === "unauthenticated") {
      loginHandler(provider, "app")
      setRedirecting(true)
    }
  }, [isCredentialProvider, provider, status])

  const getCallbackUrl = useCallback(async () => {
    const { data } = await createSession()
    if (!data) return null
    return {
      url: `${DEEPLINK_SCHEME}auth?ck=${data.ck}&userId=${data.userId}`,
      userId: data.userId,
    }
  }, [])

  const handleOpenApp = useCallback(async () => {
    const callbackUrl = await getCallbackUrl()
    if (!callbackUrl) return
    window.open(callbackUrl.url, "_top")
  }, [getCallbackUrl])

  const onceRef = useRef(false)
  useEffect(() => {
    if (isAuthenticated && !onceRef.current) {
      handleOpenApp()
    }
    onceRef.current = true
  }, [handleOpenApp, isAuthenticated])

  const LoginOrStatusContent = useMemo(() => {
    switch (true) {
      case isAuthenticated: {
        return (
          <div className="flex w-full flex-col items-center justify-center gap-10 px-4">
            <div className="relative flex items-center justify-center">
              <UserAvatar className="gap-4 px-10 py-4 text-2xl" />
              <div className="absolute right-0">
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await signOut()
                    await refetch()
                  }}
                >
                  <i className="i-mingcute-exit-line text-xl" />
                </Button>
              </div>
            </div>
            <h2 className="text-center">
              {t("redirect.successMessage", { app_name: APP_NAME })} <br />
              <br />
              {t("redirect.instruction", { app_name: APP_NAME })}
            </h2>
            <div className="center flex flex-col gap-20 sm:flex-row">
              <Button
                variant="text"
                className="h-14 text-base"
                onClick={() => {
                  window.location.href = "/"
                }}
              >
                {t("redirect.continueInBrowser")}
              </Button>

              <Button className="h-14 !rounded-full px-5 text-lg" onClick={handleOpenApp}>
                {t("redirect.openApp", { app_name: APP_NAME })}
              </Button>
            </div>
          </div>
        )
      }
      default: {
        if (!authProviders?.credential) {
          return (
            <div className="flex w-[350px] max-w-full flex-col gap-3">
              {Object.entries(authProviders || [])
                .filter(([key]) => key !== "credential")
                .map(([key, provider]) => (
                  <Button
                    key={key}
                    buttonClassName={cn(
                      "h-[48px] w-full rounded-[8px] font-sans text-base text-white hover:!bg-black/80 focus:!border-black/80 focus:!ring-black/80",
                      authProvidersConfig[key]?.buttonClassName,
                    )}
                    onClick={() => {
                      loginHandler(key, "app")
                    }}
                  >
                    <i className={cn("mr-2 text-xl", authProvidersConfig[key]?.iconClassName)} />{" "}
                    {t("login.continueWith", {
                      provider: provider.name,
                    })}
                  </Button>
                ))}
            </div>
          )
        } else {
          return (
            <>
              <LoginWithPassword />
              <div className="mt-2 w-full space-y-2">
                <div className="flex items-center justify-center">
                  <Divider className="flex-1" />
                  <p className="text-muted-foreground px-4 text-center text-sm">{t("login.or")}</p>
                  <Divider className="flex-1" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-4">
                {Object.entries(authProviders || [])
                  .filter(([key]) => key !== "credential")
                  .map(([key, provider]) => (
                    <MotionButtonBase
                      key={key}
                      onClick={() => {
                        loginHandler(key, "app")
                      }}
                    >
                      <div
                        className="center hover:bg-muted inline-flex rounded-full border p-2.5 duration-200 [&_svg]:size-6"
                        dangerouslySetInnerHTML={{
                          __html: provider.icon,
                        }}
                        style={{
                          color: provider.color,
                        }}
                      />
                    </MotionButtonBase>
                  ))}
              </div>
            </>
          )
        }
      }
    }
  }, [authProviders, handleOpenApp, isAuthenticated, refetch, t])
  const Content = useMemo(() => {
    switch (true) {
      case redirecting: {
        return <div className="center">{t("login.redirecting")}</div>
      }
      default: {
        return <div className="flex flex-col gap-3">{LoginOrStatusContent}</div>
      }
    }
  }, [LoginOrStatusContent, redirecting, t])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <Logo className="size-16" />

      {!isAuthenticated && !isLoading && (
        <h1 className="mb-6 mt-8 text-2xl">
          {t("login.logInTo")} <b>{` ${APP_NAME}`}</b>
        </h1>
      )}
      {Content}
      {isLoading && <LoadingCircle className="mt-8" size="large" />}
    </div>
  )
}

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  code: z.string().length(6).regex(/^\d+$/).optional(),
})

function LoginWithPassword() {
  const { t } = useTranslation("external")
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })
  const [needTwoFactor, setNeedTwoFactor] = useState(false)

  const { isSubmitting } = form.formState
  const navigate = useNavigate()

  const recaptchaRef = useRef<ReCAPTCHA>(null)

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (needTwoFactor && values.code) {
      const res = await twoFactor.verifyTotp({ code: values.code })
      if (res?.error) {
        toast.error(res.error.message)
      } else {
        queryClient.invalidateQueries({ queryKey: ["auth", "session"] })
      }
      return
    }

    const token = await recaptchaRef.current?.executeAsync()
    const res = await loginHandler("credential", "app", {
      ...values,
      headers: {
        "x-token": `r2:${token}`,
      },
    })
    if (res?.error) {
      toast.error(res.error.message)
      return
    }
    if ((res?.data as any)?.twoFactorRedirect) {
      setNeedTwoFactor(true)
      form.setValue("code", "")
      form.setFocus("code")
      return
    } else {
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("login.email")}</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between">
                {t("login.password")}
                <Link
                  to="/forget-password"
                  className="text-accent block py-1 text-xs hover:underline"
                >
                  {t("login.forget_password.note")}
                </Link>
              </FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {needTwoFactor && (
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("login.two_factor.code")}</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <ReCAPTCHA ref={recaptchaRef} sitekey={env.VITE_RECAPTCHA_V2_SITE_KEY} size="invisible" />
        <Button type="submit" buttonClassName="!mt-3 w-full" isLoading={isSubmitting} size="lg">
          {t("login.continueWith", { provider: t("words.email") })}
        </Button>
        <Button
          type="button"
          buttonClassName="!mt-3"
          className="w-full"
          variant="outline"
          onClick={() => {
            navigate("/register")
          }}
          size="lg"
        >
          <Trans ns="external" i18nKey="login.signUp" />
        </Button>
      </form>
    </Form>
  )
}
